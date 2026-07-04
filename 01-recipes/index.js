const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { generateRecipe, generateSearchParameters } = require('./gemini');

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
// a middelware function to verify the JWT token, it happens before the route handler is called
// the next parameter will refer to the next middleware
// or if there is no more middleware, thhe route handler will be called
function verifyToken(req, res, next) {

    // the token is sent in the Authorization header, in the format of "Bearer <token>"
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];

        if (token) {
            // verify the token's claims and expiry matches the signiture
            jwt.verify(token, process.env.TOKEN_SECRET, function(err,claims) {
                if (err) {
                    res.status(403).json({
                        "message": "Invalid token"
                    });
                } else {
                    // save in the request the logged in user, so that the route handler can use it
                    req.user = claims;
                    next();
                }
            });
        }

    } else {
        res.status(400).json({
            "message": "Authorization header not found"
        })
    }
    
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
    // cuisines: search by cuisine
    // ingredients search a comma delimited list
    // ?name=chicken&cuisine=Chinese&ingredients=chicken&tags=easy
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

    app.post("/api/recipes", [verifyToken], async function(req, res){
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

        newRecipe.user_id = new ObjectId(req.user.user_id); // associate the recipe with the logged in user
        
        const response = await db.collection("recipes").insertOne(newRecipe);
        res.json({
            message: "Recipe added successfully",
            recipeId: response.insertedId
        });
    })

    app.delete("/api/recipes/:recipeId", [verifyToken], async function(req, res){
        const recipeId = req.params.recipeId;
    
        // find the recipe by its id and the user_id of the logged in user, to make sure the user can only delete their own recipes
        const recipe = await db.collection("recipes").findOne({
            user_id: new ObjectId(req.user.user_id),
            _id: new ObjectId(req.params.recipeId)
        });
        if (recipe) {
        // delete one document which has the _id equal to the recipeId
        const result = await db.collection("recipes").deleteOne({
             _id: new ObjectId(recipeId) 
            })
        res.json({
            message: "Recipe deleted successfully"
        })
        } else {
        res.status(400).json({
            message: "Recipe not found, or you do not owe the recipe"})
        }
    })

    // PATCH or PUT
    app.put("/api/recipes/:recipeId", [verifyToken], async function(req, res){
        // get the new recipe from the request's body
        const newRecipe = req.body;
        
        const recipe = await db.collection("recipes").findOne({
            user_id: new ObjectId(req.user.user_id),
            _id: new ObjectId(req.params.recipeId)
        })
        // find the cuisine and associate the recipe with the cuisine
        const cuisine = await db.collection("cuisines").findOne({ 
            name: newRecipe.cuisine });

        const tags = await db.collection("tags").find({ 
            name: { $in: req.body.tags } 
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
        })

    })

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
                    })
                } else {
                    res.status(401).json({
                        message: "Wrong email or password"
                    })
                }
            } else {
                res.status(401).json({
                    message: "Wrong email or password"
                })
            }
        })
    app.get("/api/me", verifyToken, async function(req, res){
        // the req.user is set by the verifyToken middleware
        const user = await db.collection("users").findOne({ 
            _id: new ObjectId(req.user.user_id) 
        });
        delete user.password; // remove the password from the user object before sending it back
        res.json({
                "user": user
            })
    })

    app.post('/api/ai/recipes', async function(req, res) {
        
        const allCuisines = await db.collection("cuisines").find().toArray();
        const allTags = await db.collection("tags").find().toArray();
        const allingredients = await db.collection("recipes").distinct("ingredients.name");
        const recipe = await generateRecipe(
            req.body.recipeText,
            allCuisines,
            allTags
        );

        // check if the recipe's cuisine is valid
        const cuisine = await db.collection("cuisines").findOne({ 
            _id: new ObjectId(recipe.cuisine._id.$oid),
            name: recipe.cuisine.name
        });

        if (!cuisine) {
            res.status(500).json({
                "error": `${recipe.cuisine.name} is chosen by the AI but is not in the system`
            })
        }

        for (let tags of recipe.tags) {
            const tagDoc = await db.collection("tags").findOne({ 
                _id: new ObjectId(tags._id.$oid),
                name: tags.name
            });
            // if the tag document not found
            if (!tagDoc) {
                return res.status(500).json({
                    "message": `${tag.name} is chosen by the AI but is not in the system`
                });
            }
        }

        const recipeId = await db.collection("recipes").insertOne(recipe);

        res.json({ 
            "message": "New recipe inserted. from natural text by AI",
            "recipeId": recipeId.insertedId
        });
    })

    app.get('/api/ai/recipes', async function(req, res) {
        const allCuisines = await db.collection("cuisines").find().toArray();
        const allTags = await db.collection("tags").find().toArray();
        const allingredients = await db.collection("recipes").distinct("ingredients.name");

        const searchParameters = await generateSearchParameters(
            req.query.searchQuery,
            allCuisines,
            allTags,
            allingredients
        );

        res.json({ searchParameters });
    })

}

main();

app.listen(3000, function(){
    console.log('Server is running on port 3000');
})
