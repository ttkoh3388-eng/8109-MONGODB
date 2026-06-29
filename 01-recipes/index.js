const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
require('dotenv').config();

const app = express();

async function main() {

    const db = await connect(process.env.MONGO_URI, "8109_recipes");

    // routes will in here

    // Search for receipes
    // the req.query can contain following parameters
    // name: string pattern for the name 
    // tags: a comma delimited string list, eg. "easy,spicy"
    app.get("/api/recipes", async function(req, res){

        const criteria = {};
        if (req.query.name) {
            criteria.name = { 
                $regex: req.query.name, 
                $options: 'i' };
        }

        if (req.query.tags) {
            const wantedtags = req.query.tags.split(',');
            criteria['tags.name'] = { "$in": wantedtags };
        }

        if (req.query.cuisine) {
            criteria['cuisine.name'] = { 
                $regex: req.query.cuisine, 
                $options: 'i' };
        }
        // we'll expect req.query.ingredients to be a comma delimited strings
        // "chicken,flour,eggs".split(",") => ["chicken", "flour", "eggs"]
        if (req.query.ingredients) {
            const wantedingredients = req.query.ingredients.split(',');
            const regexArray = [];

            for (const ingredient of wantedingredients) {
                regexArray.push(new RegExp(ingredient, 'i'));
            }
            criteria['ingredients.name'] = { "$all": regexArray };
        }

        const recipes = await db.collection("recipes").find(criteria).toArray();
        res.json({
            recipes: recipes
        });

    })
}
main();

app.listen(3000, function(){
    console.log('Server is running on port 3000');
});