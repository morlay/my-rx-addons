import {
  Observable,
  Subscription as test,
} from "rxjs"

console.log(test)

const first = Observable.interval(2500)
const second = Observable.interval(2000)
const third = Observable.interval(1500)
const fourth = Observable.interval(1000)

const example = Observable
  .merge(
    first.mapTo("FIRST!"),
    second.mapTo("SECOND!"),
    third.mapTo("THIRD"),
    fourth.mapTo("FOURTH"),
  )
  .filter((v) => typeof v === "string")
  .merge((v: string) => v)

example.subscribe((val: string) => console.log(val))