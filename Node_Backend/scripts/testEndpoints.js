import axios from "axios";

const BASE_URL = process.env.BACKEND_PUBLIC_URL || "http://localhost:8000";

/**
 * Stage 10: End-to-End Test Script
 * Sequentially tests Validate, Upsell, and Push endpoints.
 */
async function runTests() {
    console.log(`🧪 Starting local E2E Voice Endpoint Tests against ${BASE_URL}...\n`);

    const results = [
        { name: "Test 1: Validate Items", status: "PENDING" },
        { name: "Test 2: Upsell Engine", status: "PENDING" },
        { name: "Test 3: Push Order (Dry Run)", status: "PENDING" },
        { name: "Test 4: Get Menu", status: "PENDING" },
        { name: "Test 5: Get Item Price", status: "PENDING" },
    ];

    let allPassed = true;

    try {
        // ------------------------------------------------------------------------
        // Test 1: Validate Items
        // ------------------------------------------------------------------------
        console.log("▶️ Running Test 1: Validate Items...");
        const validateRes = await axios.post(`${BASE_URL}/api/voice/validate-items`, {
            items: ["classic burger", "coke", "nonexistent_dragon_fruit"]
        });

        const vData = validateRes.data;
        const hasMatch = vData.some((i) => i.matched === true);
        const hasUnmatch = vData.some((i) => i.matched === false);

        if (hasMatch && hasUnmatch) {
            results[0].status = "PASS";
        } else {
            results[0].status = `FAIL (match count unexpected)`;
            allPassed = false;
        }

        const validFoodId = vData.find(i => i.matched)?.food_id || 1;

        // ------------------------------------------------------------------------
        // Test 2: Upsell Engine
        // ------------------------------------------------------------------------
        console.log("▶️ Running Test 2: Upsell Engine...");
        // Provide a valid food ID to trigger upselling something else
        const upsellRes = await axios.post(`${BASE_URL}/api/voice/get-upsell`, {
            cart: [{ food_id: validFoodId, quantity: 1 }]
        });

        const uData = upsellRes.data;
        if (uData.suggested_phrase && uData.upsell_item_name) {
            results[1].status = "PASS";
        } else {
            results[1].status = `FAIL (no suggested_phrase). Res: ${JSON.stringify(uData)}`;
            allPassed = false;
        }

        // ------------------------------------------------------------------------
        // Test 3: Push Order (Dry Run)
        // ------------------------------------------------------------------------
        console.log("▶️ Running Test 3: Push Order (Dry Run)...");
        const pushRes = await axios.post(`${BASE_URL}/api/voice/push-order`, {
            cart: [{ food_id: 1, quantity: 1, price: 150 }],
            customer_phone: "+919876543210",
            dry_run: true
        });

        if (pushRes.data.success === true && pushRes.data.order_id === "DRY_RUN") {
            results[2].status = "PASS";
        } else {
            results[2].status = `FAIL (invalid success response)`;
            allPassed = false;
        }

        // ------------------------------------------------------------------------
        // Test 4: Get Menu
        // ------------------------------------------------------------------------
        console.log("▶️ Running Test 4: Get Menu...");
        const menuRes = await axios.post(`${BASE_URL}/api/voice/get-menu`, {
            category: "pizza"
        });

        if (menuRes.data.items && Array.isArray(menuRes.data.items)) {
            results[3].status = "PASS";
        } else {
            results[3].status = `FAIL (res: ${JSON.stringify(menuRes.data)})`;
            allPassed = false;
        }

        // ------------------------------------------------------------------------
        // Test 5: Get Item Price
        // ------------------------------------------------------------------------
        console.log("▶️ Running Test 5: Get Item Price...");
        const priceRes = await axios.post(`${BASE_URL}/api/voice/get-item-price`, {
            item_name: "burger"
        });

        if (priceRes.data.price !== undefined) {
            results[4].status = "PASS";
        } else {
            results[4].status = `FAIL (invalid price response)`;
            allPassed = false;
        }

    } catch (error) {
        allPassed = false;
        console.error("\n❌ An endpoint request crashed unexpectedly:");
        if (error.response) {
            console.error(error.response.status, error.response.data);
        } else {
            console.error(error.message);
        }
    }

    console.log("\n==================================");
    console.log("         TEST RESULTS SUMMARY     ");
    console.log("==================================");
    results.forEach((r) => {
        const icon = r.status === "PASS" ? "✅" : "❌";
        console.log(`${icon}  ${r.name.padEnd(30, " ")} : ${r.status}`);
    });
    console.log("==================================\n");

    if (!allPassed) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
