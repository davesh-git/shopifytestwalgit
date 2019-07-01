const shopAccessUtil = require('./../constants/shopAccess.js')
const chalk = require('chalk')
const request = require('request')

const getToken = (shopName, client_id, client_secret, authcode) => {

   const url = 'https://' + shopName + encodeURIComponent(shopAccessUtil.tokenURLPart)
   // const url ='https://test-wal-mp.myshopify.com/admin/oauth/access_token' //Commented for WalmartApp Playground

    const body = {
        client_id,
        client_secret,
        code: authcode
    }

    const options = {
        url: url,
        method: 'POST',
        json: true,
        body:body
    }

    console.log(options)

    return new Promise((resolve, reject) => {
        request(options, (error, response) => {

            console.log(chalk.red('Error:' + error + ',' + 'Response:' + response))
            //Connection failure
            if (error) {

                reject('Error Code: There was an error in connecting to Shopify Token API')
                // callback({ Error: 'Error Code: There was an error in connecting to Shopify Token API' })
            }
            //API call error , invalid response
            else if (response.body == undefined) {
                reject('Error: ' + response.statusCode + ':' + 'Error in getting data')
                //callback({ Error: 'Error:' + response.statusCode + ':' + 'Error in getting data' })
            }
            //Success
            else {
                //callback({ token: response.body.token, scope: response.body.scope })
                resolve({ token: response.body.access_token, scope: response.body.scope })
            }
        })

    })

}

module.exports = {
    getToken: getToken
}