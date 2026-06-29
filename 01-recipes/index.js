const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
require('dotenv').config();

const app = express();

async function main() {

    const db = await connect(process.env.MONGO_URI, "8109_recipes");

    // routes will in here
    app.get("/recipes", async function(req, res){
        const recipes = await db.collection("recipes").find().toArray();
        res.json({
            recipes: recipes
        });

    })
}
main();

app.listen(3000, function(){
    console.log('Server is running on port 3000');
});