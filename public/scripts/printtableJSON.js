function CreateTableFromJSON(jsonData) {

    console.log('JSondata:' + jsonData)
    // EXTRACT VALUE FOR HTML HEADER. 
    var col = []
    for (var i = 0; i < jsonData.length; i++) {
        for (var key in jsonData[i]) {
            if (col.indexOf(key) === -1) {
                col.push(key)
                console.log('Column:' + col)
            }
        }
    }

    // CREATE DYNAMIC TABLE.
    var table = document.createElement("table")

    // CREATE HTML TABLE HEADER ROW USING THE EXTRACTED HEADERS ABOVE.

    var tr = table.insertRow(-1)                 // TABLE ROW.

    for (var i = 0; i < col.length; i++) {
        var th = document.createElement("th");      // TABLE HEADER.
        th.innerHTML = col[i]
        tr.appendChild(th)
    }

    // ADD JSON DATA TO THE TABLE AS ROWS.
    for (var i = 0; i < jsonData.length; i++) {

        tr = table.insertRow(-1)

        for (var j = 0; j < col.length; j++) {
            var tabCell = tr.insertCell(-1)

            if ([col[j]] == 'variants') {
                var variantData = JSON.stringify(jsonData[i][col[j]])
                tabCell.innerHTML = variantData
            }
            else {
                tabCell.innerHTML = jsonData[i][col[j]]
            }
        }
    }

    console.log('data ready in script to create table')
    // FINALLY ADD THE NEWLY CREATED TABLE WITH JSON DATA TO A CONTAINER.
    var divContainer = document.getElementById('prod')
    divContainer.innerHTML = ''
    divContainer.appendChild(table)
}
