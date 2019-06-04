//To get all the .env file config parameters in process.env
const dotenv = require('dotenv')
dotenv.config()
const envVars = process.env

module.exports = {
    envVars
}