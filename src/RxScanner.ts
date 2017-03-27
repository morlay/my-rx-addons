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

  private rxAddons: { [key: string]: string } = {}
  private usedMethods: { [key: string]: true } = {}

  constructor() {
    this.readRxAddons()
  }

  readRxAddons() {
    const files = glob.sync("node_modules/rxjs/add/**/*.js")
    files.forEach((file: string) => {
      const pkgName = path.dirname(file.replace("node_modules/", ""))
      const methodName = path.basename(file, ".js")
      this.rxAddons[methodName] = path.join(pkgName, methodName)
    })
  }

  createRxMethodVisit = (checker: ts.TypeChecker) =>
    (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.CallExpression) {
        const callExpr = (node as ts.CallExpression)

        if (callExpr.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
          const propertyAccessExpression = (callExpr.expression as ts.PropertyAccessExpression)
          const callerName = propertyAccessExpression.name

          const targetCallSignature = checker.getResolvedSignature(callExpr)
          const returnType = targetCallSignature.getReturnType()

          if (isTypeDeclaredInRxPkg(returnType)) {
            this.collectMethod(callerName.text)
          }
        }
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

  collectMethod(method: string) {
    this.usedMethods[method] = true
    return this
  }

  output(outputFilename: string = "my-rx-addons.ts") {
    let output = ""

    for (const usedMethod in this.usedMethods) {
      if (this.rxAddons[usedMethod]) {
        output += `import "${this.rxAddons[usedMethod]}"\n`
      }
    }

    fse.outputFileSync(outputFilename, output)
    console.log(`generated file to ${outputFilename}`)
  }
}