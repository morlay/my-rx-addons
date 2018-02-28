import * as yargs from "yargs";
import { RxScanner } from "./RxScanner";

const argv = yargs(process.argv.slice(2))
  .usage("Usage: $0 <rootDir> [options]")
  .example("my-rx-addons src2/** src1/**")
  .options({
    output: {
      type: "string",
      alias: "o",
    },
  })
  .help("help")
  .alias("help", "h")
  .showHelpOnFail(false, "whoops, something went wrong! run with --help").argv;

RxScanner.create()
  .scan(...argv._)
  .output(argv.output);
