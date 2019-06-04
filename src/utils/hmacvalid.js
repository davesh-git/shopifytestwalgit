
const envVarUtil = require('./envars.js')
const crypto = require('crypto')
const chalk = require('chalk')

const hmacvalid = (queryURLParts, callback) => {

    const HMAC = queryURLParts.get('hmac')
    queryURLParts.delete('hmac')
    const remParamStr = queryURLParts.toString() // Calculate hexdigest on this and match with hmac
    const newHMAC = crypto.createHmac('sha256', envVarUtil.envVars.SHOPIFY_SECRET_API_KEY).update(remParamStr).digest('hex')

    console.log(chalk.green('HMAC:'+HMAC+'/n Calculated HMAC: '+newHMAC))
    if (HMAC == newHMAC)
        return callback('true')
    else
        return callback('false')
}

module.exports = hmacvalid



