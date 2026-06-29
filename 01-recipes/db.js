const { MongoClient, ServerApiVersion } = require('mongodb');

let client = null;

// argument 1: connection string
// argument 2: database name
async function connect(uri, dbName) {
    if (client) {
        return client;
    }

    client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1
        }
    })

    // attempt to conect to mongo 
    await client.connect();
    console.log('Connected to MongoDB');

    // return a database object
    // eqv. to in Mongo Compass: use dbname;
    return client.db(dbName);
}

// share the connect function with the other JavaScript files
module.exports = { connect };