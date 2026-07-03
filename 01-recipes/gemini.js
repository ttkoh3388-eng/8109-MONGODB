require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_SECRET
});
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

async function generateRecipe(recipeText, availableCuisines, availableTags) {
    const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Recipe",
        "type": "object",
        "properties": {
            "name": {
                "type": "string"
            },
            "cuisine": {
                "type": "object",
                "properties": {
                    "_id": {
                        "type": "object",
                        "properties": {
                            "$oid": {
                                "type": "string"
                            }
                        },
                        "required": ["$oid"]
                    },
                    "name": {
                        "type": "string"
                    }
                },
                "required": ["_id", "name"]
            },
            "prepTime": {
                "type": "integer"
            },
            "cookTime": {
                "type": "integer"
            },
            "servings": {
                "type": "integer"
            },
            "ingredients": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string"
                        },
                        "amount": {
                            "type": "number"
                        },
                        "unit": {
                            "type": "string"
                        }
                    },
                    "required": ["name", "amount", "unit"]
                }
            },
            "instructions": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            },
            "tags": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "_id": {
                            "type": "object",
                            "properties": {
                                "$oid": {
                                    "type": "string"
                                }
                            },
                            "required": ["$oid"]
                        },
                        "name": {
                            "type": "string"
                        }
                    },
                    "required": ["_id", "name"]
                }
            }
        },
        "required": [
            "name",
            "cuisine",
            "prepTime",
            "cookTime",
            "servings",
            "ingredients",
            "instructions",
            "tags"],
        "additionalProperties": false
    };
    const prompt = `
        You are a recipe parser. Convert the user's natural recipe text to a JSON object, using
        the available tags and cuisines and ONLY following tags and cuisines. 
        Make sure _id matches the available reference cuisines and tags. 
    
        Available cuisines: ${JSON.stringify(availableCuisines)}
        Available tags: ${JSON.stringify(availableTags)}

        Convert the natural text using the following schema: ${JSON.stringify(schema)}

        Rules:
        - Return only valid JSON, no explanation, no code fences 
        - only use the available tags, do not invent new tags
        - only use the available cuisines, do not invent new cuisines

        User's recipe text: ${recipeText}   
        
    `
    const aiResponse = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            // force Gemini to return a JSON structure
            responseMimeType:"application/json",
            responseJsonSchema: schema
        }
    })

    const recipe = JSON.parse(aiResponse.text);
    return recipe;
}
    // share with other Javascript files, so that they can use the same instance of the AI client
    module.exports = {
        ai, MODEL, generateRecipe
    };