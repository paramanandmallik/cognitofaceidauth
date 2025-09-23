import fs from 'fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// Read the markdown file
const markdownContent = fs.readFileSync('./BLOG.md', 'utf8');

// Simple markdown to docx converter
function convertMarkdownToDocx(markdown) {
    const lines = markdown.split('\n');
    const paragraphs = [];
    
    for (const line of lines) {
        if (line.startsWith('# ')) {
            // H1 heading
            paragraphs.push(new Paragraph({
                text: line.substring(2),
                heading: HeadingLevel.HEADING_1
            }));
        } else if (line.startsWith('## ')) {
            // H2 heading
            paragraphs.push(new Paragraph({
                text: line.substring(3),
                heading: HeadingLevel.HEADING_2
            }));
        } else if (line.startsWith('### ')) {
            // H3 heading
            paragraphs.push(new Paragraph({
                text: line.substring(4),
                heading: HeadingLevel.HEADING_3
            }));
        } else if (line.startsWith('```')) {
            // Skip code block markers
            continue;
        } else if (line.trim() === '') {
            // Empty line
            paragraphs.push(new Paragraph({ text: '' }));
        } else {
            // Regular paragraph
            const children = [];
            let text = line;
            
            // Handle bold text **text**
            text = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
                children.push(new TextRun({ text: content, bold: true }));
                return '|||BOLD|||';
            });
            
            // Handle code `text`
            text = text.replace(/`([^`]+)`/g, (match, content) => {
                children.push(new TextRun({ text: content, font: 'Courier New' }));
                return '|||CODE|||';
            });
            
            // Split text and add runs
            const parts = text.split('|||');
            let childIndex = 0;
            
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === 'BOLD' || parts[i] === 'CODE') {
                    // Skip, already added to children
                    continue;
                } else if (parts[i]) {
                    children.push(new TextRun({ text: parts[i] }));
                }
            }
            
            if (children.length === 0) {
                children.push(new TextRun({ text: line }));
            }
            
            paragraphs.push(new Paragraph({ children }));
        }
    }
    
    return paragraphs;
}

// Create the document
const doc = new Document({
    sections: [{
        properties: {},
        children: convertMarkdownToDocx(markdownContent)
    }]
});

// Generate the Word document
Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync('Face_ID_Touch_ID_Authentication_Blog.docx', buffer);
    console.log('Word document generated: Face_ID_Touch_ID_Authentication_Blog.docx');
});