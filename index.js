const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Initialize Express app for health checks
const app = express();
app.use(cors());
app.use(express.json());

// Bot token from environment variable
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is required in environment variables');
  process.exit(1);
}

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Store user sessions
const userSessions = new Map();

// Supported formats
const SUPPORTED_FORMATS = {
  'docx': ['pdf', 'txt', 'html', 'md', 'rtf', 'odt'],
  'pdf': ['docx', 'txt', 'html', 'md', 'png', 'jpg'],
  'txt': ['docx', 'pdf', 'html', 'md'],
  'html': ['docx', 'pdf', 'txt', 'md'],
  'md': ['docx', 'pdf', 'html', 'txt'],
  'rtf': ['docx', 'pdf', 'txt'],
  'odt': ['docx', 'pdf', 'txt'],
  'png': ['jpg', 'jpeg', 'pdf'],
  'jpg': ['png', 'pdf']
};

// Welcome message
const WELCOME_MESSAGE = `
🎯 Welcome to WordConvertPro Bot!

I can convert your documents between various formats. Here's how to use me:

📤 *How to use:*
1. Send me any document file
2. I'll detect its format
3. Reply with the format you want to convert to

📁 *Supported Formats:*
• Documents: DOCX, PDF, TXT, HTML, MD, RTF, ODT
• Images: PNG, JPG/JPEG

💡 *Example:*
Send a PDF file, then reply with "docx" to convert it to Word format.

📌 *Commands:*
/start - Show this welcome message
/help - Show help and supported formats
/formats - List all supported conversions
/cancel - Cancel current session

Built with ❤️ using Railway
`;

const HELP_MESSAGE = `
📚 *Help & Supported Conversions*

${Object.entries(SUPPORTED_FORMATS).map(([from, to]) => 
  `• *${from.toUpperCase()}* → ${to.map(f => f.toUpperCase()).join(', ')}`
).join('\n')}

*Commands:*
/start - Start the bot
/help - Show this help
/formats - List all conversions
/cancel - Cancel current operation

Need help? Just reply with the format you want to convert to!
`;

// Helper function to convert file
async function convertFile(filePath, fromFormat, toFormat) {
  // This is a placeholder - you'll need to implement actual conversion
  // You can use APIs like CloudConvert, Zamzar, or local libraries
  try {
    // Simulate conversion delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo purposes, we'll just return the original file
    // In production, implement actual conversion logic here
    return filePath;
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

// Helper function to get file extension
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// Helper function to get file format
function getFileFormat(filename) {
  const ext = getFileExtension(filename);
  const formatMap = {
    'doc': 'docx',
    'docx': 'docx',
    'pdf': 'pdf',
    'txt': 'txt',
    'html': 'html',
    'htm': 'html',
    'md': 'md',
    'rtf': 'rtf',
    'odt': 'odt',
    'png': 'png',
    'jpg': 'jpg',
    'jpeg': 'jpeg'
  };
  return formatMap[ext] || ext;
}

// Bot command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, WELCOME_MESSAGE, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, HELP_MESSAGE, { parse_mode: 'Markdown' });
});

bot.onText(/\/formats/, (msg) => {
  const chatId = msg.chat.id;
  let formatsList = '📋 *Available Conversions*\n\n';
  Object.entries(SUPPORTED_FORMATS).forEach(([from, to]) => {
    formatsList += `🔄 *${from.toUpperCase()}* → ${to.map(f => f.toUpperCase()).join(', ')}\n`;
  });
  bot.sendMessage(chatId, formatsList, { parse_mode: 'Markdown' });
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  userSessions.delete(chatId);
  bot.sendMessage(chatId, '✅ Current session cancelled. Send me a file to start a new conversion!');
});

// Handle document and photo uploads
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const file = msg.document;
  
  try {
    // Get file info
    const fileInfo = await bot.getFile(file.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    
    // Detect file format
    const format = getFileFormat(file.file_name);
    
    if (!SUPPORTED_FORMATS[format]) {
      bot.sendMessage(
        chatId, 
        `❌ Format *${format.toUpperCase()}* is not supported.\n\nSupported formats: ${Object.keys(SUPPORTED_FORMATS).map(f => f.toUpperCase()).join(', ')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Store session
    userSessions.set(chatId, {
      fileInfo,
      fileUrl,
      fileName: file.file_name,
      format,
      fileId: file.file_id
    });
    
    // Ask for target format
    const availableFormats = SUPPORTED_FORMATS[format].map(f => f.toUpperCase()).join(', ');
    bot.sendMessage(
      chatId,
      `📄 Detected file: *${file.file_name}* (${format.toUpperCase()})\n\n` +
      `🔄 Available conversions: ${availableFormats}\n\n` +
      `Please reply with the format you want to convert to (e.g., "pdf"):`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error handling document:', error);
    bot.sendMessage(chatId, '❌ Error processing your file. Please try again.');
  }
});

// Handle photo uploads
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1]; // Get highest quality
  
  try {
    // Get file info
    const fileInfo = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    
    // Store session for image
    userSessions.set(chatId, {
      fileInfo,
      fileUrl,
      fileName: `image_${Date.now()}.jpg`,
      format: 'jpg',
      fileId: photo.file_id
    });
    
    // Ask for target format
    bot.sendMessage(
      chatId,
      `📸 Detected image (JPG)\n\n` +
      `🔄 Available conversions: PNG, PDF\n\n` +
      `Please reply with the format you want to convert to (e.g., "png"):`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error handling photo:', error);
    bot.sendMessage(chatId, '❌ Error processing your image. Please try again.');
  }
});

// Handle text messages (for format selection)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Skip if it's a command or if there's no text
  if (!text || text.startsWith('/')) return;
  
  // Check if user has an active session
  const session = userSessions.get(chatId);
  if (!session) {
    // If no session, send a helpful message
    bot.sendMessage(
      chatId,
      '👋 Send me a document or image to start converting!\n\n' +
      'Supported formats: DOCX, PDF, TXT, HTML, MD, RTF, ODT, PNG, JPG\n\n' +
      'Use /help for more information.'
    );
    return;
  }
  
  // Check if the requested format is valid
  const targetFormat = text.toLowerCase().trim();
  const availableFormats = SUPPORTED_FORMATS[session.format] || [];
  
  if (!availableFormats.includes(targetFormat)) {
    bot.sendMessage(
      chatId,
      `❌ Invalid format: *${targetFormat.toUpperCase()}*\n\n` +
      `Available formats: ${availableFormats.map(f => f.toUpperCase()).join(', ')}\n\n` +
      `Please reply with a valid format or use /cancel to cancel.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Process the conversion
  try {
    bot.sendMessage(chatId, `⏳ Converting to *${targetFormat.toUpperCase()}*... Please wait.`, { parse_mode: 'Markdown' });
    
    // Download the file
    const fileResponse = await axios({
      method: 'get',
      url: session.fileUrl,
      responseType: 'stream'
    });
    
    // Save file temporarily
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const tempFilePath = path.join(tempDir, `input_${Date.now()}.${session.format}`);
    const writer = fs.createWriteStream(tempFilePath);
    fileResponse.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Convert the file
    const convertedFilePath = await convertFile(tempFilePath, session.format, targetFormat);
    
    // Send the converted file back
    const outputFileName = `converted_${Date.now()}.${targetFormat}`;
    await bot.sendDocument(chatId, convertedFilePath, {
      caption: `✅ Converted successfully!\n\n📄 From: ${session.format.toUpperCase()}\n📄 To: ${targetFormat.toUpperCase()}`,
      filename: outputFileName
    });
    
    // Clean up temporary files
    try {
      fs.unlinkSync(tempFilePath);
      if (convertedFilePath !== tempFilePath) {
        fs.unlinkSync(convertedFilePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }
    
    // Clear session
    userSessions.delete(chatId);
    
  } catch (error) {
    console.error('Error during conversion:', error);
    bot.sendMessage(
      chatId, 
      '❌ An error occurred during conversion. Please try again or use /cancel to start fresh.'
    );
  }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🤖 Bot @WordConvertProBot is running!`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  bot.stopPolling();
  process.exit(0);
});

// Error handling for bot
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🚀 Bot is starting...');
