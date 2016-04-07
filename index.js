var H = require('highland')
var config = require('histograph-config')
var postgis = require('histograph-db-postgis')
var elasticsearch = require('histograph-db-elasticsearch')
var neo4j = require('histograph-db-neo4j')
var redis = require('redis')
var redisClient = redis.createClient(config.redis.port, config.redis.host)

// TODO:
// - Delete API's owner database (/Users/bertspaan/data/histograph/api)
// - Delete IO's datasets
// - Deletes results from spacetime-etl steps?

var tasks = [
  {
    func: (callback) => {
      redisClient.flushall(callback)
    },
    message: 'Executing Redis FLUSHALL'
  },
  {
    func: (callback) => {
      elasticsearch.delete(null, callback)
    },
    message: 'Deleting all Elasticsearch indices'
  },
  {
    func: postgis.truncate,
    message: 'Truncating PostgreSQL table'
  },
  {
    func: neo4j.deleteAll,
    message: 'Deleting all nodes and relations from Neo4j'
  }
]

function executeTask (task, callback) {
  console.log(`  - ${task.message}`)
  task.func(callback)
}

console.log('Starting Supernova - deleting all data from the Space/Time Directory!\n')
H(tasks)
  .map(H.curry(executeTask))
  .nfcall([])
  .series()
  .done(() => {
    redisClient.quit()
    console.log('\nSupernova completed!')
  })
