import * as fse from "fs-extra"
import * as glob from "glob"
import * as path from "path"
import * as ts from "typescript"

export const isTypeDeclaredInRxPkg = (type: ts.Type): boolean => {
  const symbol = type.getSymbol()
  if (symbol) {
    const filename = symbol.getDeclarations()[0].getSourceFile().path
    return filename.indexOf("node_modules/rxjs/") > -1
  }
  return false
}

export class RxScanner {
  static create() {
    return new RxScanner()
  }

  private rxClasses: { [key: string]: string } = {}
  private rxOperators: { [key: string]: string } = {}
  private rxObservables: { [key: string]: string } = {}
  private usedClasses: { [key: string]: true } = {}
  private usedOperators: { [key: string]: true } = {}
  private usedObservables: { [key: string]: true } = {}

  constructor() {
    this.readRxMethods()
  }

  isRxClass(className: string): boolean {
    return !!this.rxClasses[className]
  }

  readRxMethods() {
    const addons = glob.sync("node_modules/rxjs/add/**/*.js")
    const classes = glob.sync("node_modules/rxjs/*.js")

    addons
      .concat(classes)
      .forEach((file: string) => {
        const pkgName = path.dirname(file.replace("node_modules/", ""))
        const methodName = path.basename(file, ".js")
        if (pkgName.indexOf("operator") > -1) {
          this.rxOperators[methodName] = path.join(pkgName, methodName)
        }
        if (pkgName.indexOf("observable") > -1) {
          this.rxObservables[methodName] = path.join(pkgName, methodName)
        }
        if (pkgName == "rxjs") {
          this.rxClasses[methodName] = path.join(pkgName, methodName)
        }
      })
  }

  createRxMethodVisit = (checker: ts.TypeChecker) =>
    (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
          const importDeclaration = node as ts.ImportDeclaration
          if ((importDeclaration.moduleSpecifier as ts.StringLiteral).text == "rxjs") {
            (importDeclaration.importClause.namedBindings as ts.NamedImports)
              .elements
              .forEach((importSpecifier: ts.ImportSpecifier) => {
                if (importSpecifier.propertyName) {
                  this.usedClasses[importSpecifier.propertyName.text] = true
                }
                if (importSpecifier.name) {
                  this.usedClasses[importSpecifier.name.text] = true
                }
              })
          }
          break
        case ts.SyntaxKind.CallExpression:
          const callExpr = (node as ts.CallExpression)

          if (callExpr.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propertyAccessExpression = (callExpr.expression as ts.PropertyAccessExpression)
            const callerName = propertyAccessExpression.name
            const callerNameText = callerName.getText()

            const targetCallSignature = checker.getResolvedSignature(callExpr)
            const returnType = targetCallSignature.getReturnType()
            if (isTypeDeclaredInRxPkg(returnType)) {
              if (propertyAccessExpression.expression.kind === ts.SyntaxKind.Identifier) {
                const expressionId = propertyAccessExpression.expression as ts.Identifier
                const expressionIdType = checker.getTypeAtLocation(expressionId)
                const expressionIdTypeClassName = checker.symbolToString(expressionIdType.getSymbol())
                if (expressionIdTypeClassName === expressionId.getText()) {
                  this.usedObservables[callerNameText] = true
                } else {
                  this.usedOperators[callerNameText] = true
                }
              } else {
                this.usedOperators[callerNameText] = true
              }
            }
          }
          break
      }
      ts.forEachChild(node, this.createRxMethodVisit(checker))
    }

  scan(...src: string[]) {
    if (src.length === 0) {
      throw new Error("scan need `src`")
    }

    const files = src
      .reduce((finalFiles, pattern) => {
        return finalFiles.concat(glob.sync(pattern, {
          nodir: true,
          dot: true,
          realpath: true,
        }))
      }, [])
      .filter((filename: string) => [".ts", ".tsx"].indexOf(path.extname(filename)) > -1)

    const filePaths = files.map((s) => s.toLowerCase())

    const program = ts.createProgram(files, {})
    const checker = program.getTypeChecker()

    for (const sourceFile of program.getSourceFiles()) {
      if (filePaths.indexOf(sourceFile.path) > -1) {
        ts.forEachChild(sourceFile, this.createRxMethodVisit(checker))
      }
    }

    return this
  }

  output(outputFilename: string = "my-rx-addons.ts") {
    const exportedClasses = []

    for (const usedClass in this.usedClasses) {
      if (this.rxClasses[usedClass]) {
        console.log(`use class from ${usedClass}`)
        exportedClasses.push(`export { ${usedClass} } from "${this.rxClasses[usedClass]}"`)
      }
    }

    const addedObservables = []
    for (const usedObservable in this.usedObservables) {
      if (this.rxObservables[usedObservable]) {
        console.log(`use observable ${usedObservable}`)
        addedObservables.push(`import "${this.rxObservables[usedObservable]}"`)
      }
    }

    const usedOperators = []
    for (const usedOperator in this.usedOperators) {
      if (this.rxOperators[usedOperator]) {
        console.log(`use operator ${usedOperator}`)
        usedOperators.push(`import "${this.rxOperators[usedOperator]}"`)
      }
    }

    fse.outputFileSync(outputFilename, []
      .concat(exportedClasses)
      .concat(addedObservables.sort())
      .concat(usedOperators.sort())
      .join("\n"),
    )
    console.log(`generated file to ${outputFilename}`)
  }
}