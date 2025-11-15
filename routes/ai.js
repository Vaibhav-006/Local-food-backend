const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Food = require('../models/Food');
const router = express.Router();

// Initialize Gemini AI (with error handling)
let genAI;
try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini AI initialized successfully');
    } else {
        console.warn('⚠️  GEMINI_API_KEY not configured');
    }
} catch (error) {
    console.error('❌ Error initializing Gemini AI:', error);
}

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'AI recommendations route is working!',
        geminiConfigured: !!genAI
    });
});

// @route   POST /api/ai/recommendations
// @desc    Get AI-powered food recommendations using Gemini 2.5 Flash
// @access  Public
router.post('/recommendations', async (req, res) => {
    try {
        console.log('📥 Received AI recommendation request');
        const { prompt } = req.body;

        // Validate prompt
        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide a prompt describing what you are looking for.' 
            });
        }

        // Validate API key
        if (!genAI || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
            console.error('❌ Gemini API key not configured');
            return res.status(500).json({ 
                success: false, 
                message: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.' 
            });
        }

        // Start with all foods, sorted by rating
        let foods = await Food.find().sort({ createdAt: -1 }).lean();
        
        if (foods.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No food items available in the database.' 
            });
        }

        // Pre-filter foods based on prompt keywords before sending to AI
        const promptLower = prompt.toLowerCase();
        let filteredFoods = foods;

        // Extract location/city from prompt
        const cityKeywords = ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'bombay', 'calcutta', 'rajpura', 'patiala', 'chandigarh', 'amritsar', 'ludhiana', 'jalandhar'];
        const mentionedCity = cityKeywords.find(city => promptLower.includes(city));
        if (mentionedCity) {
            filteredFoods = filteredFoods.filter(food => {
                const foodCity = (food.city || '').toLowerCase();
                const foodAddress = (food.address || '').toLowerCase();
                return foodCity.includes(mentionedCity) || 
                       foodAddress.includes(mentionedCity) ||
                       mentionedCity.includes(foodCity) ||
                       (foodCity && foodCity.split(' ').some(word => word.includes(mentionedCity)));
            });
        }

        // Extract cuisine type from prompt
        const cuisineKeywords = ['italian', 'indian', 'chinese', 'japanese', 'thai', 'mexican', 'american', 'mediterranean', 'asian', 'dessert', 'vegetarian', 'vegan', 'korean', 'french', 'spanish'];
        const mentionedCuisine = cuisineKeywords.find(cuisine => promptLower.includes(cuisine));
        if (mentionedCuisine) {
            filteredFoods = filteredFoods.filter(food => {
                const cuisineType = (food.cuisineType || '').toLowerCase();
                return cuisineType.includes(mentionedCuisine) || 
                       mentionedCuisine.includes(cuisineType) ||
                       (cuisineType && cuisineType.split(' ').some(word => word.includes(mentionedCuisine)));
            });
        }

        // Extract dietary requirements
        if (promptLower.includes('vegetarian') && !promptLower.includes('non-vegetarian') && !promptLower.includes('non vegetarian')) {
            filteredFoods = filteredFoods.filter(food => 
                food.dietary && food.dietary.vegetarian
            );
        }
        if (promptLower.includes('vegan')) {
            filteredFoods = filteredFoods.filter(food => 
                food.dietary && food.dietary.vegan
            );
        }
        if (promptLower.includes('gluten-free') || promptLower.includes('gluten free')) {
            filteredFoods = filteredFoods.filter(food => 
                food.dietary && food.dietary.glutenfree
            );
        }
        if (promptLower.includes('halal')) {
            filteredFoods = filteredFoods.filter(food => 
                food.dietary && food.dietary.halal
            );
        }

        // Extract budget from prompt - improved to handle dynamic amounts
        let budgetMax = null;
        let budgetMin = null;
        
        // Match patterns like "under 100", "under 100rs", "under ₹100", "below 200", etc.
        const underMatch = promptLower.match(/(?:under|below|less than|upto|up to)\s*(?:₹|rs|rupees?)?\s*(\d+)/);
        if (underMatch) {
            budgetMax = parseInt(underMatch[1]);
        }
        
        // Match patterns like "over 500", "above 1000", "more than 2000", etc.
        const overMatch = promptLower.match(/(?:over|above|more than)\s*(?:₹|rs|rupees?)?\s*(\d+)/);
        if (overMatch) {
            budgetMin = parseInt(overMatch[1]);
        }
        
        // Match range patterns like "500-1000", "500 to 1000", "between 500 and 1000"
        const rangeMatch = promptLower.match(/(\d+)\s*(?:-|to|and)\s*(\d+)/);
        if (rangeMatch && !underMatch && !overMatch) {
            budgetMin = parseInt(rangeMatch[1]);
            budgetMax = parseInt(rangeMatch[2]);
        }
        
        // Apply budget filter
        if (budgetMax !== null || budgetMin !== null) {
            filteredFoods = filteredFoods.filter(food => {
                if (!food.price) {
                    // If no price, check priceRange
                    if (budgetMax !== null && budgetMax < 500) {
                        return food.priceRange === '₹';
                    } else if (budgetMax !== null && budgetMax < 1000) {
                        return food.priceRange === '₹' || food.priceRange === '₹₹';
                    } else if (budgetMax !== null && budgetMax < 2000) {
                        return food.priceRange === '₹' || food.priceRange === '₹₹' || food.priceRange === '₹₹₹';
                    }
                    return true; // Include items without price if we can't determine
                }
                
                if (budgetMax !== null && food.price > budgetMax) {
                    return false;
                }
                if (budgetMin !== null && food.price < budgetMin) {
                    return false;
                }
                return true;
            });
        }

        // Store original count to check if filtering happened
        const originalFoodCount = foods.length;
        const filteredFoodCount = filteredFoods.length;

        // Check if any filtering was applied
        const wasFiltered = !!mentionedCity || !!mentionedCuisine || 
                           promptLower.includes('vegetarian') || 
                           promptLower.includes('vegan') || 
                           promptLower.includes('gluten-free') || 
                           promptLower.includes('gluten free') ||
                           promptLower.includes('halal') ||
                           budgetMax !== null ||
                           budgetMin !== null;
        
        // If filtering was applied but no items match, return error
        if (filteredFoods.length === 0 && wasFiltered) {
            return res.status(404).json({
                success: false,
                message: 'No food items found matching your specific criteria. Please try adjusting your request (e.g., different location, cuisine, or budget).',
                recommendations: []
            });
        }
        
        // Always limit the dataset sent to AI to prevent showing all items
        // If filtering happened, use filtered results (max 50)
        // If no filtering, limit to top 30 by rating
        if (wasFiltered && filteredFoods.length > 50) {
            filteredFoods = filteredFoods.slice(0, 50);
        } else if (!wasFiltered) {
            // No specific keywords detected - limit to top 30 for AI to filter based on prompt text
            filteredFoods = foods.slice(0, 30);
        }

        // Sort filtered foods by rating (highest rating first, then by rating count)
        filteredFoods.sort((a, b) => {
            const ratingA = (a.rating && a.rating.average) || 0;
            const countA = (a.rating && a.rating.count) || 0;
            const ratingB = (b.rating && b.rating.average) || 0;
            const countB = (b.rating && b.rating.count) || 0;
            
            // First sort by rating (descending)
            if (ratingB !== ratingA) {
                return ratingB - ratingA;
            }
            // If ratings are equal, sort by number of ratings (descending)
            return countB - countA;
        });

        // Prepare food data for AI (include rating information)
        const foodData = filteredFoods.map(food => ({
            title: food.title,
            description: food.description,
            cuisineType: food.cuisineType,
            vendorName: food.vendorName,
            city: food.city,
            address: food.address,
            price: food.price,
            priceRange: food.priceRange,
            tags: food.tags || [],
            dietary: food.dietary || {},
            nutrition: food.nutrition || {},
            rating: {
                average: (food.rating && food.rating.average) || 0,
                count: (food.rating && food.rating.count) || 0
            }
        }));

        // Build prompt for Gemini to understand user's request and recommend foods
        let aiPrompt = `You are a food recommendation assistant. Your job is to STRICTLY filter and recommend ONLY food items that match the user's request.

USER REQUEST:
"${prompt}"

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY recommend food items that MATCH the user's request
2. If the user mentions a location/city, ONLY include items from that EXACT location
3. If the user mentions a budget, ONLY include items within that budget range
4. If the user mentions dietary requirements (vegetarian, vegan, gluten-free, halal), ONLY include items that meet those requirements
5. If the user mentions a cuisine type, ONLY include items of that cuisine type
6. If the user mentions specific preferences (spicy, sweet, comfort food, etc.), ONLY include items that match
7. DO NOT recommend items that don't match the user's criteria
8. Among matching items, prioritize those with HIGHER RATINGS (check the "rating" field: { "average": X.X, "count": N })
9. Return MAXIMUM 5-6 recommendations that STRICTLY match the user's request

Available Food Items (${foodData.length} items, already pre-filtered and sorted by rating):
${JSON.stringify(foodData, null, 2)}

FILTERING INSTRUCTIONS:
- Analyze the user's request carefully
- Extract: location, cuisine type, budget, dietary requirements, and any specific preferences
- ONLY select items that match ALL relevant criteria mentioned by the user
- If no items match perfectly, select the closest matches but explain why in the "reason" field
- Prioritize items with higher ratings among matching items

Return ONLY a JSON array with this exact structure (maximum 5-6 items, highest rated first):
[
  {
    "title": "Exact food title from the list",
    "vendorName": "Exact vendor name from the list",
    "city": "Exact city from the list",
    "reason": "Why this matches the user's request AND why it's highly rated",
    "price": "Price or price range",
    "rating": "X.X stars (Y reviews)",
    "matchScore": "High/Medium/Low"
  }
]

IMPORTANT: Only return items that match the user's request. If you cannot find matching items, return an empty array or fewer items, but DO NOT return items that don't match.

Respond ONLY with valid JSON array, no additional text or explanation.`;

        // Get the Gemini 2.5 Flash model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Generate recommendations
        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        let recommendationsText = response.text();

        // Clean up the response (remove markdown code blocks if present)
        recommendationsText = recommendationsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse the JSON response
        let recommendations;
        try {
            recommendations = JSON.parse(recommendationsText);
            // Ensure recommendations is an array
            if (!Array.isArray(recommendations)) {
                recommendations = [];
            }
            // If AI returned empty array, it means no matches found
            if (recommendations.length === 0) {
                console.log('AI returned empty recommendations - no items match the prompt');
            }
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            console.error('Raw response:', recommendationsText);
            
            // Don't fallback to all foods - use pre-filtered foods only
            recommendations = [];
        }

        // Match recommendations with actual food items from database (use filteredFoods, not all foods)
        const matchedFoods = recommendations.map(rec => {
            // Try exact match first
            let matchedFood = filteredFoods.find(f => 
                f.title.toLowerCase().trim() === rec.title?.toLowerCase().trim()
            );
            
            // If no exact match, try partial match
            if (!matchedFood) {
                matchedFood = filteredFoods.find(f => 
                    f.title.toLowerCase().includes(rec.title?.toLowerCase()) ||
                    rec.title?.toLowerCase().includes(f.title.toLowerCase())
                );
            }
            
            // If still no match, try vendor name match
            if (!matchedFood && rec.vendorName) {
                matchedFood = filteredFoods.find(f => 
                    f.vendorName && (
                        f.vendorName.toLowerCase().trim() === rec.vendorName.toLowerCase().trim() ||
                        f.vendorName.toLowerCase().includes(rec.vendorName.toLowerCase())
                    )
                );
            }
            
            if (matchedFood) {
                const rating = matchedFood.rating || { average: 0, count: 0 };
                return {
                    ...matchedFood,
                    aiReason: rec.reason || `A highly-rated ${matchedFood.cuisineType} option matching your preferences`,
                    matchScore: rec.matchScore || 'Medium',
                    ratingDisplay: rating.average > 0 
                        ? `${rating.average.toFixed(1)} stars (${rating.count} reviews)`
                        : 'No ratings yet'
                };
            }
            return null;
        }).filter(Boolean);

        // Post-validate matched foods against prompt criteria (double-check filtering)
        const validatedFoods = matchedFoods.filter(food => {
            // Check location if mentioned
            if (mentionedCity) {
                const foodCity = (food.city || '').toLowerCase();
                const foodAddress = (food.address || '').toLowerCase();
                if (!foodCity.includes(mentionedCity) && !foodAddress.includes(mentionedCity)) {
                    return false;
                }
            }
            
            // Check cuisine if mentioned
            if (mentionedCuisine) {
                const foodCuisine = (food.cuisineType || '').toLowerCase();
                if (!foodCuisine.includes(mentionedCuisine)) {
                    return false;
                }
            }
            
            // Check dietary requirements
            if (promptLower.includes('vegetarian') && !promptLower.includes('non-vegetarian') && !promptLower.includes('non vegetarian')) {
                if (!food.dietary || !food.dietary.vegetarian) {
                    return false;
                }
            }
            if (promptLower.includes('vegan')) {
                if (!food.dietary || !food.dietary.vegan) {
                    return false;
                }
            }
            if (promptLower.includes('gluten-free') || promptLower.includes('gluten free')) {
                if (!food.dietary || !food.dietary.glutenfree) {
                    return false;
                }
            }
            if (promptLower.includes('halal')) {
                if (!food.dietary || !food.dietary.halal) {
                    return false;
                }
            }
            
            // Check budget (using extracted budget values)
            if (budgetMax !== null && food.price && food.price > budgetMax) {
                return false;
            }
            if (budgetMin !== null && food.price && food.price < budgetMin) {
                return false;
            }
            
            return true;
        });

        // Use validated foods (post-filtered) instead of just matched foods
        let finalFoods = validatedFoods.length > 0 ? validatedFoods : matchedFoods;

        // If no validated matches found, try to use pre-filtered foods (already filtered by prompt)
        if (finalFoods.length === 0) {
            // Use the pre-filtered foods that match the prompt criteria (only if filtering was applied)
            if (filteredFoods.length > 0 && wasFiltered) {
                // We have pre-filtered results, use them
                const topFilteredFoods = filteredFoods.slice(0, 5).map(food => {
                    const rating = food.rating || { average: 0, count: 0 };
                    return {
                        ...food,
                        aiReason: `This highly-rated ${food.cuisineType} dish from ${food.vendorName} in ${food.city} matches your request!`,
                        matchScore: 'Medium',
                        ratingDisplay: rating.average > 0 
                            ? `${rating.average.toFixed(1)} stars (${rating.count} reviews)`
                            : 'No ratings yet'
                    };
                });
                
                return res.json({
                    success: true,
                    recommendations: topFilteredFoods,
                    message: `Found ${topFilteredFoods.length} food items matching your request!`
                });
            } else {
                // No pre-filtering happened or AI didn't return matches, return error
                return res.status(404).json({
                    success: false,
                    message: 'No food items found matching your request. Please try a different prompt or check your criteria.',
                    recommendations: []
                });
            }
        }

        // Sort final foods by rating again (in case AI didn't follow rating priority)
        finalFoods.sort((a, b) => {
            const ratingA = (a.rating && a.rating.average) || 0;
            const countA = (a.rating && a.rating.count) || 0;
            const ratingB = (b.rating && b.rating.average) || 0;
            const countB = (b.rating && b.rating.count) || 0;
            
            if (ratingB !== ratingA) {
                return ratingB - ratingA;
            }
            return countB - countA;
        });

        // Limit to top 6 recommendations (already sorted by rating)
        const finalRecommendations = finalFoods.slice(0, 6);

        res.json({
            success: true,
            recommendations: finalRecommendations,
            message: `Found ${finalRecommendations.length} personalized recommendations for you!`
        });

    } catch (error) {
        console.error('❌ AI recommendation error:', error);
        console.error('Error stack:', error.stack);
        
        // Fallback: Return top-rated foods if AI fails
        try {
            let foods = await Food.find().sort({ createdAt: -1 }).lean();
            
            // Sort by rating
            foods.sort((a, b) => {
                const ratingA = (a.rating && a.rating.average) || 0;
                const countA = (a.rating && a.rating.count) || 0;
                const ratingB = (b.rating && b.rating.average) || 0;
                const countB = (b.rating && b.rating.count) || 0;
                
                if (ratingB !== ratingA) {
                    return ratingB - ratingA;
                }
                return countB - countA;
            });
            
            // Get top 5-6 rated foods
            const topFoods = foods.slice(0, 6);
            
            const fallbackRecommendations = topFoods.map(food => {
                const rating = food.rating || { average: 0, count: 0 };
                return {
                    ...food,
                    aiReason: `This highly-rated ${food.cuisineType} dish from ${food.vendorName} in ${food.city} is a great option!`,
                    matchScore: 'Medium',
                    ratingDisplay: rating.average > 0 
                        ? `${rating.average.toFixed(1)} stars (${rating.count} reviews)`
                        : 'No ratings yet'
                };
            });
            
            return res.json({
                success: true,
                recommendations: fallbackRecommendations,
                message: `Found ${fallbackRecommendations.length} highly-rated food items!`,
                note: 'AI service temporarily unavailable, showing top-rated results.'
            });
        } catch (fallbackError) {
            console.error('❌ Fallback error:', fallbackError);
            return res.status(500).json({ 
                success: false, 
                message: 'Error generating recommendations. Please try again later.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

module.exports = router;

