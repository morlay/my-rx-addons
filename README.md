## My Rx Addons

Automate generate `rxjs/add/*/*` imports by TypeScript codes

### Usage

#### By CLI

```
npm i -g @morlay/my-rx-addons
```

```
my-rx-addons src2/** src1/** -o my-rx-addons.ts
```

### By API 

```js

import { RxScanner } from "@morlay/my-rx-addons";

RxScanner
  .create()
  .scan("src2/**", "src1/**")
  .output("my-rx-addons.ts")
```

### Know Issues

* Not support alias like `flatMap`
* `Subject.create` or other static create method will broken because of `Subject.create` return type of `Function`;