const PublishResults = require("./publishResults.js");

let publish = new PublishResults()

let start = Date.now()
publish.processResults()
console.log(`Elapsed time: ${(Date.now()-start)/1000}`)
