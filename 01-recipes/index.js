const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// use JSON rerquests (prevent req.body is undefined)
app.use(express.json());

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

    app.post("/api/recipes", async function(req, res){
        // add the new recipe from the request's body
        const newRecipe = req.body;
        
        // find the cuisine and associate the recipe with the cuisine
        const cuisine = await db.collection("cuisines").findOne({ 
            name: newRecipe.cuisine });

        const tags = await db.collection("tags").find({ 
            name: { $in: req.body.tags } 
        }).toArray();
        
        // replace the newRecipe's cuisine and tags with the ones from the database
        newRecipe.cuisine = cuisine;
        newRecipe.tags = tags;
                
        const response = await db.collection("recipes").insertOne(newRecipe);
        res.json({
            message: "Recipe added successfully",
            recipeId: response.insertedId
        });
    })

    app.delete("/api/recipes/:recipeId", async function(req, res){
        const recipeId = req.params.recipeId;

        // delete one document which has the _id equal to the recipeId
        const result = await db.collection("recipes").deleteOne({
             _id: new ObjectId(recipeId) 
            })
        res.json({
            message: "Recipe deleted successfully"
        });
    });
}
main();

app.listen(3000, function(){
    console.log('Server is running on port 3000');
});