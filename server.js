const express = require('express')
const { investing } = require('investing-com-api')
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 8080
const clients = []

const whitelist = ['https://kimpro.site', 'http://localhost:3000', 'http://localhost:3001']
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not Allowed Origin!'))
    }
  },
}

app.use(cors(corsOptions))
app.use(morgan('combined'))

let lastData = null
let isFetching = false

const fetchData = async () => {
  if (isFetching) return

  isFetching = true

  try {
    const allData = await investing('currencies/usd-krw', 'P1D', 'PT1M', 60, {
      headless: 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      ignoreHTTPSErrors: true,
    })

    const latestData = allData[allData.length - 1]

    if (!lastData || latestData.price_close !== lastData.price_close) {
      for (const client of clients) {
        client.write(`data: ${JSON.stringify(latestData)}\n\n`)
      }
      lastData = latestData
    }
  } catch (err) {
    console.error(err)
    for (const client of clients) {
      client.write(`error: ${err.message}\n\n`)
    }
  }
  isFetching = false
}

app.get('/exchange-rate', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  clients.push(res)

  if (lastData) {
    res.write(`data: ${JSON.stringify(lastData)}\n\n`)
    console.log(`Client connected, total clients: ${clients.length}`)
  }

  req.on('close', () => {
    const index = clients.indexOf(res)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    console.log(`Client disconnected, total clients: ${clients.length}`)
  })
})

setInterval(fetchData, 40000)

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
  fetchData()
})
