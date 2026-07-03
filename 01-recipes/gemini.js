require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_SECRET
});
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

async function generateRecipe(recipeText, availableCuisines, availableTags) {

    const prompt = `
    You are a recipe generator. Convert the user's natural recipe text to a JSON object, using
    the available tags and cuisines and ONLY following tags and cuisines. 
    
    Available cuisines: ${availableCuisines}
    Available tags: ${availableTags}

    Convert the natural text using the following schema:
    

// share with other Javascript files, so that they can use the same instance of the AI client
module.exports = {
    ai, MODEL
}