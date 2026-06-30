const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();
const jwt = require('jsonwebtoken');

function generateAccessToken(id) {
    // arg 1: the claims, or the payload 
    // arg 2: the hashing key 
    return jwt.sign({
        "user_id": id,
        "role": "user"
    }, process.env.TOKEN_SECRET, {
        expiresIn: "3w"
    });
}

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
    })

    // PATCH or PUT
    app.put("/api/recipes/:recipeId", async function(req, res){
        // get the new recipe from the request's body
        const newRecipe = req.body;
       
        // find the cuisine and associate the recipe with the cuisine
        const cuisine = await db.collection("cuisines").findOne({ 
            name: newRecipe.cuisine });

        const tags = await db.collection("tags").find({ 
            name: { 
                $in: req.body.tags } 
        }).toArray();
        
        // replace the newRecipe's cuisine and tags with the ones from the database
        newRecipe.cuisine = cuisine;
        newRecipe.tags = tags;

        const response = await db.collection("recipes").updateOne({
            _id: new ObjectId(req.params.recipeId)
        }, {
            $set: newRecipe
        });
        res.json({
            message: "Successfully updated the recipe",
        });

    });

    // register a new user
    // shape of req.body: { username: string, password: string }
    app.post("/api/users", async function(req, res){
        const result = await db.collection("users").insertOne({
            email: req.body.email,
            password: await bcrypt.hash(req.body.password, 12)
        });
        res.json({
            message: "User registered successfully",    
            userId: result.insertedId
        })
    })

    app.post("/api/login", async function(req, res){
        const email = req.body.email;
        const password = req.body.password;
        // find the user by email
        const user = await db.collection("users").findOne({ 
            "email": email });
            if (user){
        // check if the password matches
        // bcrypt.compare(password, hashed.password) returns a promise that resolves to true or false
                if (await bcrypt.compare(password, user.password)) {
                    // create a JWT token and send it back to the client
                    const token = generateAccessToken(user._id);
                    // create and send back the JWT 
                    res.json({
                        "message": "Login successful",
                        "token": token
                    });
                } else {
                    res.status(401).json({
                        message: "Wrong email or password"
                    });
                }
            } else {
                res.status(401).json({
                    message: "Wrong email or password"
                });
            }
        })
    }

main();

app.listen(3000, function(){
    console.log('Server is running on port 3000');
})
