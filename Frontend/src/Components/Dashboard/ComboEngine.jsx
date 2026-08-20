import { useState, useEffect } from "react";
import { foodItemsAPI, recommendationsAPI } from "../../services/api";

export default function ComboEngine() {
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchComboData();
    }, []);

    const fetchComboData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all food items
            const foodItemsResponse = await foodItemsAPI.getAll();
            const foodItems = foodItemsResponse.data;

            if (!foodItems || foodItems.length === 0) {
                setError("No food items found");
                return;
            }

            // For each food item, get top 2 recommendations
            const comboPromises = foodItems.map(async (item) => {
                try {
                    const recommendationResponse = await recommendationsAPI.get({
                        cart: [item.id],
                        limit: 2,
                        threshold: 0 // Get recommendations even with low scores
                    });

                    const suggestions = recommendationResponse.data?.suggestions || [];
                    
                    return {
                        itemId: item.id,
                        itemName: item.name,
                        category: item.category_name,
                        recommendations: suggestions.map(sugg => ({
                            name: sugg.name,
                            matchPercentage: Math.min(100, (sugg.score * 10)).toFixed(1) // Convert score to percentage
                        }))
                    };
                } catch (err) {
                    console.error(`Error fetching recommendations for ${item.name}:`, err);
                    return {
                        itemId: item.id,
                        itemName: item.name,
                        category: item.category_name,
                        recommendations: []
                    };
                }
            });

            const comboResults = await Promise.all(comboPromises);
            
            // Filter items that have at least one recommendation
            const combosWithRecommendations = comboResults.filter(
                combo => combo.recommendations.length > 0
            );

            setCombos(combosWithRecommendations);
        } catch (err) {
            console.error("Error fetching combo data:", err);
            setError("Failed to load combo recommendations. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>Loading combo recommendations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--brand-red)", marginBottom: "1rem" }}>{error}</p>
                <button onClick={fetchComboData} style={{
                    padding: "0.5rem 1rem", background: "var(--brand-red)", color: "#fff",
                    border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700
                }}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: "2rem" }}>
                <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Module 02 · Combo Intelligence
                </p>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Combo Engine</h1>
            </div>
            <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>
                        Perfect Pairings
                    </h3>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        AI-powered combo recommendations based on order history
                    </p>
                </div>

                {combos.length === 0 ? (
                    <div style={{ padding: "3rem", textAlign: "center" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem" }}>
                            No combo recommendations available yet. More order data is needed.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table" style={{ minWidth: 640 }}>
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Top Combo #1</th>
                                    <th>Match %</th>
                                    <th>Top Combo #2</th>
                                    <th>Match %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {combos.map(combo => {
                                    const rec1 = combo.recommendations[0];
                                    const rec2 = combo.recommendations[1];
                                    
                                    return (
                                        <tr key={combo.itemId}>
                                            <td style={{ fontWeight: 700, color: "var(--navy)" }}>
                                                {combo.itemName}
                                            </td>
                                            <td style={{ color: "var(--text-muted)" }}>
                                                {combo.category}
                                            </td>
                                            {rec1 ? (
                                                <>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {rec1.name}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            color: parseFloat(rec1.matchPercentage) >= 70 
                                                                ? "var(--success)" 
                                                                : parseFloat(rec1.matchPercentage) >= 50
                                                                ? "var(--navy)"
                                                                : "var(--text-muted)"
                                                        }}>
                                                            {rec1.matchPercentage}%
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</td>
                                                    <td style={{ color: "var(--text-muted)" }}>—</td>
                                                </>
                                            )}
                                            {rec2 ? (
                                                <>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {rec2.name}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            color: parseFloat(rec2.matchPercentage) >= 70 
                                                                ? "var(--success)" 
                                                                : parseFloat(rec2.matchPercentage) >= 50
                                                                ? "var(--navy)"
                                                                : "var(--text-muted)"
                                                        }}>
                                                            {rec2.matchPercentage}%
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</td>
                                                    <td style={{ color: "var(--text-muted)" }}>—</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 6 }}>
                <p style={{ fontSize: "0.8125rem", color: "#0369A1", lineHeight: 1.6 }}>
                    <strong>💡 How it works:</strong> The AI analyzes past orders to find items frequently bought together. 
                    Match percentage shows how often customers pair these items when ordering.
                </p>
            </div>
        </div>
    );
}

