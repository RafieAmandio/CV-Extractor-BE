#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const pdfService = require('./src/services/pdfService');
const openaiService = require('./src/services/openaiService');
const logger = require('./src/utils/logger');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function printColor(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

async function testMultimodalExtraction() {
  try {
    printColor('🧪 Testing Multimodal CV Extraction', 'magenta');
    printColor('='.repeat(40), 'magenta');

    // Find a sample PDF file
    const cvFolder = './cv_sample';
    const pdfFiles = fs.readdirSync(cvFolder)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .slice(0, 1); // Test with first file

    if (pdfFiles.length === 0) {
      printColor('❌ No PDF files found in cv_sample folder', 'red');
      return;
    }

    const testFile = path.join(cvFolder, pdfFiles[0]);
    printColor(`\n📄 Testing with file: ${pdfFiles[0]}`, 'blue');

    // Step 1: Test text extraction
    printColor('\n🔍 Step 1: Testing text extraction...', 'cyan');
    const extractedText = await pdfService.extractText(testFile);
    const isTextSufficient = pdfService.isTextSufficient(extractedText);
    
    printColor(`📝 Extracted text length: ${extractedText.length}`, 'white');
    printColor(`✅ Text sufficient: ${isTextSufficient}`, isTextSufficient ? 'green' : 'yellow');
    
    if (extractedText.length > 0) {
      const preview = extractedText.substring(0, 200).replace(/\n/g, ' ');
      printColor(`📖 Text preview: "${preview}..."`, 'white');
    }

    // Step 2: Test image extraction (regardless of text sufficiency)
    printColor('\n🖼️  Step 2: Testing image extraction...', 'cyan');
    try {
      const imageBuffers = await pdfService.extractImages(testFile);
      printColor(`📷 Extracted ${imageBuffers.length} images`, 'green');
      
      imageBuffers.forEach((buffer, index) => {
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        printColor(`   Image ${index + 1}: ${sizeMB}MB`, 'white');
      });

      // Step 3: Test vision-based extraction
      if (imageBuffers.length > 0) {
        printColor('\n👁️  Step 3: Testing vision-based extraction...', 'cyan');
        try {
          const visionData = await openaiService.extractCVDataFromImages(imageBuffers);
          printColor('✅ Vision-based extraction successful!', 'green');
          
          // Display some extracted data
          if (visionData.personalInfo) {
            printColor('\n📋 Extracted Personal Info:', 'blue');
            printColor(`   👤 Name: ${visionData.personalInfo.name || 'Not found'}`, 'white');
            printColor(`   📧 Email: ${visionData.personalInfo.email || 'Not found'}`, 'white');
            printColor(`   📱 Phone: ${visionData.personalInfo.phone || 'Not found'}`, 'white');
            printColor(`   📍 Location: ${visionData.personalInfo.location || 'Not found'}`, 'white');
          }
          
          if (visionData.education && visionData.education.length > 0) {
            printColor('\n🎓 Education:', 'blue');
            visionData.education.slice(0, 2).forEach((edu, index) => {
              printColor(`   ${index + 1}. ${edu.degree || 'Degree'} from ${edu.institution || 'Institution'}`, 'white');
            });
          }
          
          if (visionData.experience && visionData.experience.length > 0) {
            printColor('\n💼 Experience:', 'blue');
            visionData.experience.slice(0, 2).forEach((exp, index) => {
              printColor(`   ${index + 1}. ${exp.position || 'Position'} at ${exp.company || 'Company'}`, 'white');
            });
          }
          
          if (visionData.skills && visionData.skills.length > 0) {
            printColor('\n🛠️  Skills:', 'blue');
            visionData.skills.slice(0, 3).forEach((skillCategory, index) => {
              const skills = skillCategory.skills ? skillCategory.skills.slice(0, 5).join(', ') : '';
              printColor(`   ${skillCategory.category || 'Category'}: ${skills}`, 'white');
            });
          }
          
        } catch (visionError) {
          printColor(`❌ Vision-based extraction failed: ${visionError.message}`, 'red');
        }
      }

    } catch (imageError) {
      printColor(`❌ Image extraction failed: ${imageError.message}`, 'red');
    }

    // Step 4: Compare approaches
    printColor('\n📊 Step 4: Extraction method recommendation...', 'cyan');
    if (isTextSufficient) {
      printColor('✅ Recommended method: Text-based extraction', 'green');
      printColor('   Text extraction is sufficient for this PDF', 'white');
    } else {
      printColor('⚡ Recommended method: Vision-based extraction', 'yellow');
      printColor('   Text extraction insufficient, vision would be used', 'white');
    }

    printColor('\n🎉 Multimodal extraction test completed!', 'green');

  } catch (error) {
    printColor(`💥 Test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the test
testMultimodalExtraction().catch(error => {
  printColor(`💥 Fatal test error: ${error.message}`, 'red');
  process.exit(1);
}); 