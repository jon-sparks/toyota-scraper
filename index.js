const puppeteer = require(`puppeteer`)
const express = require('express')

var cron = require('node-cron')
var format = require('pg-format')
var cors = require('cors')

const app = express()
const port = 8080

app.use(cors());

const { Pool } = require('pg')

const pool = new Pool({
  ssl: {
    rejectUnauthorized: false,
  }
})

const getCarIds = async () => pool.query(`SELECT car_id FROM cars`)

const insertCars = data => {
  const query = format(`INSERT INTO cars(car_id, model, year, mileage, grade, price, url, date) VALUES %L`, Object.values(data))

  return pool.query(query)
}

const getCars = async () => pool.query(`SELECT * FROM cars ORDER BY price DESC`)

async function getData() {

  const url = `https://carfromjapan.com/cheap-used-toyota-for-sale?keywords=gx81&sort=-createdAt&limit=999&minYear=1988&maxYear=1993`

  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  })
  const page = await browser.newPage()

  await page.goto(url)

  const carRows = await page.$$(`.car-row`)

  const cars = await Promise.all(carRows.map(async (row) => {
    const id = await row.$eval(`td:nth-of-type(2) .text-color`, child => child.textContent)
    const model = await row.$eval(`td:nth-of-type(2) h2`, child => child.textContent)
    const year = await row.$eval(`td:nth-of-type(3)`, child => child.textContent.slice(0, 4))
    const mileage = await row.$eval(`td:nth-of-type(4)`, child => child.textContent.slice(0, -2).replace(`,`, ``))
    const grade = await row.$eval(`td:nth-of-type(6)`, child => child.textContent.slice(6))
    const price = await row.$eval(`td:nth-of-type(7) strong`, child => child.textContent.slice(4).replace(`,`, ``))
    const url = await row.$eval(`td:nth-of-type(1)`, child => child.querySelector(`a`).href)
    const dateScraped = new Date().toISOString()
    return await {
      id,
      model,
      year,
      mileage,
      grade,
      price,
      url,
      dateScraped
    }
  }))

  await browser.close()
  return cars
  
}

async function getData2() {

  const url = `https://www.beforward.jp/stocklist/client_wishes_id=/description=/make=/model=/fuel=/fob_price_from=/fob_price_to=/veh_type=/steering=/mission=/mfg_year_from=1988/mfg_month_from=/mfg_year_to=1993/mfg_month_to=/mileage_from=/mileage_to=/cc_from=/cc_to=/showmore=/drive_type=/color=/stock_country=/area=/seats_from=/seats_to=/max_load_min=/max_load_max=/veh_type_sub=/view_cnt=100/page=1/sortkey=n/sar=/from_stocklist=1/keyword=gx81/kmode=and/`

  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  })
  const page = await browser.newPage()

  await page.goto(url)

  const carRows = await page.$$(`.stocklist-row:not(.login-banner-table)`)

  const cars = await Promise.all(carRows.map(async (row) => {
    const id = await row.$eval(`.vehicle-url-link span`, child => child.textContent.replace(/[Ref No. ]/g, ``)).catch(() => false)
    const model = await row.$eval(`.make-model .vehicle-url-link`, child => child.textContent.replace(/[0-9\n.]/g, ``).trim()).catch(() => false)
    const year = await row.$eval(`.year .val`, child => child.textContent.replace(/[  *\n]/g, ``).slice(0, 4)).catch(() => false)
    const mileage = await row.$eval(`.mileage .val`, child => child.textContent.slice(0, -3).replace(/[\n.,km]/g, ``).trim()).catch(() => false)
    const price = await row.$eval(`.vehicle-price .price`, child => child.textContent.replace(/[,$]/g, ``).trim()).catch(() => false)
    const grade = ``
    const url = await row.$eval(`.veh-stock-no`, child => child.querySelector(`a`).href).catch(() => false)
    const dateScraped = new Date().toISOString()
    return await {
      id,
      model,
      year,
      mileage,
      grade,
      price,
      url,
      dateScraped
    }
  }))

  await browser.close()
  return cars
  
}

cron.schedule('10 * * * *', () => {
  console.log('running a task every 10 minutes')
  getCarIds().then(ids => {
    console.log(`Processing...`)
    const idsArray = ids.rows.map(id => id.car_id)
    getData().then(cars => {
      getData2().then(cars2 => {
        const formattedCars = [...cars, ...cars2].map(car => {
          return Object.values(car)
        })
        const filteredCars = formattedCars.filter(car => {
          return !idsArray.includes(car[0])
        })
        if (filteredCars.length) {
          console.log(`Adding ${filteredCars.length} cars to DB...`)
          insertCars(filteredCars)
        }
        console.log(`No new cars to add`)
      }).then(() => console.log(`Done`))
    })
  })
});

app.get(`/`, async (req, res) => {
  res.send(`<h1>GX81 API</h1>`)
})

app.get(`/api/cars`, (req, res) => {
  getCars().then(cars => {
    res.send(cars.rows)
  })
})

app.listen(process.env.PORT || port, () => {
  console.log(`Server running on port ${port}`)
})


