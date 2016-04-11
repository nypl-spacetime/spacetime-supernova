#!/usr/bin/env node

'use strict'

const H = require('highland')
const readline = require('readline')
const async = require('async')
const config = require('spacetime-config')
const postgis = require('spacetime-db-postgis')
const elasticsearch = require('spacetime-db-elasticsearch')
const neo4j = require('spacetime-db-neo4j')
const redis = require('redis')
const redisClient = redis.createClient(config.redis.port, config.redis.host)

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

var answered = false
async.whilst(
  () => !answered,
  (callback) => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout})
    rl.question('Supernova will delete ALL data from this Space/Time Directory instance. Are you sure? (yes/no) ', (answer) => {
      const lower = answer.toLowerCase()
      if (lower === 'y' || lower === 'yes') {
        // Yes! Start Supernova!!!
        answered = true

        H(tasks)
          .map(H.curry(executeTask))
          .nfcall([])
          .series()
          .done(() => {
            redisClient.quit()
            console.log('\nSupernova completed!')
          })
      } else if (lower === 'n' || lower === 'no') {
        answered = true
        // No... do nothing
      } else {
        console.log('Please answer yes or no!')
      }

      rl.close()
      callback()
    })
  }
)
