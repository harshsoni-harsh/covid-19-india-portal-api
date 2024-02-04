const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const path = require('path')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, 'covid19IndiaPortal.db'),
      driver: sqlite3.Database,
    })
    app.listen(3000)
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

initializeDbAndServer()

const authenticateToken = async (req, res, next) => {
  let jwtToken
  const authHeader = req.headers.authorization
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    res.status(401).send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'Super%secret@key12', async (error, payload) => {
      if (error) {
        res.status(401).send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login', async (req, res) => {
  let {username, password} = req.body
  let query = `
    SELECT password FROM user WHERE username = '${username}'
  `
  let dbResponse = await db.get(query)
  if (dbResponse === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    let passwordHash = dbResponse.password
    let isCorrect = await bcrypt.compare(
      password.toString(),
      passwordHash.toString(),
    )
    if (isCorrect) {
      const payload = {username}
      let jwtToken = jwt.sign(payload, 'Super%secret@key12')
      res.send({jwtToken})
    } else {
      res.status(400)
      res.send('Invalid password')
    }
  }
})

app.get('/states', authenticateToken, async (req, res) => {
  let query = `
    SELECT 
      state_id AS stateId,
      state_name AS stateName,
      population
    FROM
      state
  `
  let dbResponse = await db.all(query);
  res.send(dbResponse)
})

app.get('/states/:stateId', authenticateToken, async (req, res) => {
  let {stateId} = req.params
  let query = `
    SELECT 
      state_id AS stateId,
      state_name AS stateName,
      population
    FROM
      state
    WHERE state_id = '${stateId}'
  `
  let dbResponse = await db.get(query)
  res.send(dbResponse)
})

app.post('/districts', authenticateToken, async (req, res) => {
  let {districtName, stateId, cases, cured, active, deaths} = req.body
  let query = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})
  `
  let dbResponse = await db.run(query)
  res.send('District Successfully Added')
})

app.get('/districts/:districtId', authenticateToken, async (req, res) => {
  let {districtId} = req.params
  let query = `
    SELECT 
      district_id AS districtId,
      district_name AS districtName, 
      state_id AS stateId, 
      cases, 
      cured, 
      active, 
      deaths
    FROM
      district
    WHERE
      district_id = ${districtId}
  `
  let dbResponse = await db.get(query)
  res.send(dbResponse)
})

app.delete('/districts/:districtId', authenticateToken, async (req, res) => {
  let {districtId} = req.params
  let query = `
    DELETE FROM district
    WHERE district_id = ${districtId}
  `
  await db.run(query)
  res.send('District Removed')
})

app.put('/districts/:districtId', authenticateToken, async (req, res) => {
  let {districtId} = req.params
  let {districtName, stateId, cases, cured, active, deaths} = req.body
  let query = `
    UPDATE district
    SET 
      district_name = '${districtName}', 
      state_id = ${stateId}, 
      cases = ${cases}, 
      cured = ${cured}, 
      active = ${active}, 
      deaths = ${deaths}
    WHERE
      district_id = ${districtId}
  `
  let dbResponse = await db.run(query)
  res.send('District Details Updated')
})

app.get('/states/:stateId/stats', authenticateToken, async (req, res) => {
  let {stateId} = req.params
  let query = `
    SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM
      state INNER JOIN district ON state.state_id = district.state_id
    WHERE state.state_id = '${stateId}'
  `
  let dbResponse = await db.get(query)
  res.send(dbResponse)
})

app.all('/:file', (req, res) => {
  res.sendFile(path.join(__dirname, req.params.file))
})

module.exports = app
