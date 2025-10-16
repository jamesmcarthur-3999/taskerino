use serde_json::json;

// Minimal ClaudeTool struct
#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct ClaudeTool {
    name: String,
    description: String,
    #[serde(rename = "input_schema", alias = "inputSchema")]
    input_schema: serde_json::Value,
}

fn main() {
    // Simulate what comes from TypeScript (with camelCase)
    let tool_json = json!({
        "name": "test_tool",
        "description": "Test description",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Query param"
                }
            },
            "required": ["query"]
        }
    });

    // Deserialize from TypeScript format
    let tool: ClaudeTool = serde_json::from_value(tool_json).unwrap();
    
    // Serialize back to what goes to Claude API
    let serialized = serde_json::to_string_pretty(&tool).unwrap();
    
    println!("After deserialization and re-serialization:");
    println!("{}", serialized);
}
