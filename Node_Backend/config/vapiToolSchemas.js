// Node_Backend/config/vapiToolSchemas.js

export const vapiToolSchemas = [
    {
        type: "function",
        function: {
            name: "start_session",
            description: "Call this immediately at the start of a conversation to start a session. Don't mention this to the user.",
            parameters: {
                type: "object",
                properties: {
                    customer_phone: {
                        type: "string",
                        description: "The customer's phone number if available."
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_categories",
            description: "Call this ONLY when the user asks a very broad question like 'what do you have?', 'show me the menu', or 'kya milta hai?'. Returns a list of available food categories. Then you summarize them naturally, e.g. 'Hamare paas Burgers, Pizzas, Drinks aur Starters hain — kya chahiye?'",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_menu",
            description: "Call this when the user asks for options in a category (e.g. 'what pizzas do you have?' or 'what drinks are available?').",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description: "The category of food the user is asking about (e.g. 'pizza', 'burger', 'drinks')."
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "validate_items",
            description: "Validates the items the customer wants to order. If available is false, say 'Abhi [item] available nahi hai, sorry!' and immediately offer alternatives. If fallback: true is returned, say 'Ek second ruko, system thoda slow hai' and retry. If a possible_intent is returned, ask the user if they meant that item.",
            parameters: {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of item names the customer wants."
                    }
                },
                required: ["items"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_item_price",
            description: "Call this when the user asks for the price of a specific item.",
            parameters: {
                type: "object",
                properties: {
                    item_name: {
                        type: "string",
                        description: "The name of the item to check the price for."
                    }
                },
                required: ["item_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_upsell",
            description: "Gets an intelligent upsell recommendation. Call this BEFORE final order confirmation. Only call this if there is at least 1 item in the cart.",
            parameters: {
                type: "object",
                properties: {
                    cart: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                food_id: { type: "integer" },
                                quantity: { type: "integer" }
                            },
                            required: ["food_id"]
                        }
                    }
                },
                required: ["cart"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "push_order",
            description: "Finalizes the order. Call this only after the user hears the total and confirms. If items are returned as unavailable, inform the user.",
            parameters: {
                type: "object",
                properties: {
                    cart: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                food_id: { type: "integer" },
                                quantity: { type: "integer" },
                                price: { type: "number" },
                                is_upsell: { type: "boolean" },
                                upsell_discount_pct: { type: "number" }
                            },
                            required: ["food_id", "quantity", "price"]
                        }
                    },
                    customer_phone: {
                        type: "string",
                        description: "The customer's phone number."
                    },
                    transcript: {
                        type: "string",
                        description: "Brief summary of the call transcript/conversation."
                    },
                    language_detected: {
                        type: "string",
                        description: "The language the caller used (e.g. 'hindi', 'english')."
                    },
                    upsell_offered: {
                        type: "object",
                        description: "Information about the upsell that was offered. Requires food_id and synergy_score.",
                        properties: {
                            food_id: { type: "number" },
                            synergy_score: { type: "number" },
                            discount_offered: { type: "number" }
                        }
                    },
                    upsell_accepted: {
                        type: "boolean",
                        description: "True if the UPS was accepted by the user."
                    },
                    session_id: {
                        type: "number",
                        description: "The session ID returned from the start_session tool."
                    }
                },
                required: ["cart"]
            }
        }
    }
];
