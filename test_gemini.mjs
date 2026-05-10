import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyD68Uk46SIhWoIKg3MYBvBGZ1Mp_xjk-pE';

try {
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  // Test 1: Basic model init
  const tools = [{ functionDeclarations: [{ name: "tavilySearch", description: "Search the web", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }] }];
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', tools });
  
  console.log('[TEST 1] Model initialized: OK');
  
  const chat = model.startChat({
    history: [],
    systemInstruction: { parts: [{ text: 'You are a helpful assistant.' }] }
  });
  
  console.log('[TEST 2] Chat created: OK');
  
  const result = await chat.sendMessage([{ text: 'What is photosynthesis in one sentence?' }]);
  const response = result.response;
  
  // Check for tool calls
  const toolCall = response.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
  if (toolCall) {
    console.log('[TEST 3] Tool call detected:', toolCall.functionCall.name);
  } else {
    const text = response.text();
    console.log('[TEST 3] Response received OK:', text.substring(0, 200));
  }
  
  console.log('\n✅ GEMINI API IS WORKING CORRECTLY');
} catch (error) {
  console.error('\n❌ GEMINI ERROR:', error.message);
  console.error('Stack:', error.stack?.substring(0, 500));
}
