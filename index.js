#!/usr/bin/env node

'use strict'

const H = require('highland')
const readline = require('readline')
const path = require('path')
const rimraf = require('rimraf')
const async = require('async')
const config = require('spacetime-config')
const postgis = require('spacetime-db-postgis')
const elasticsearch = require('spacetime-db-elasticsearch')
const neo4j = require('spacetime-db-neo4j')
const redis = require('redis')
const redisClient = redis.createClient(config.redis.port, config.redis.host)

// Check if dataDir configuration is set
if (!(config.api.dataDir && config.api.dataDir.length > 1)) {
  console.error('Error: api.dataDir is not set in configuration file!')
  process.exit(1)
}

console.log('Supernova will delete ALL data from this Space/Time Directory instance')
console.log('Please stop all Space/Time services (spacetime-api, spacetime-core) before executing Supernova!')
console.log('')
console.log(`Supernova will clear databases, and delete data from ${config.api.dataDir}`)
console.log('')

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
  },
  {
    // TODO: delete only datasets, keep owners
    func: (callback) => {
      const dir = path.join(config.api.dataDir, 'api', '*')
      rimraf(dir, callback)
    },
    message: 'Deleting spacetime-api\'s dataset and owners database'
  },
  {
    func: (callback) => {
      const dir = path.join(config.api.dataDir, 'datasets', '*')
      rimraf(dir, callback)
    },
    message: 'Deleting spacetime-io\'s NDJSON dataset files'
  }
]

function executeTask (task, callback) {
  console.log(`  - ${task.message}`)
  task.func(callback)
}

function executeAllTasks() {
  var error = false

  H(tasks)
    .map(H.curry(executeTask))
    .nfcall([])
    .series()
    .stopOnError((err) => {
      error = true
      console.error(err.message)
    })
    .done(() => {
      redisClient.quit()
      if (error) {
        console.log('\nNot all tasks completed...')
        process.exit(1)
      } else {
        console.log('\nSupernova completed!')
      }
    })
}

var answered = false
async.whilst(
  () => !answered,
  (callback) => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout})
    rl.question('Are you sure you want to proceed? (yes/no) ', (answer) => {
      const lower = answer.toLowerCase()
      if (lower === 'y' || lower === 'yes') {
        // Yes! Start Supernova!!!
        answered = true
        executeAllTasks()
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
