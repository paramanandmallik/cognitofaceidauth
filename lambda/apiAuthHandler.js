const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: 'us-east-1' });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        let key = 'index.html';
        
        if (event.pathParameters && event.pathParameters.proxy) {
            key = event.pathParameters.proxy;
        }
        
        const command = new GetObjectCommand({
            Bucket: 'faceid-auth-1730092800',
            Key: key
        });
        
        const result = await s3Client.send(command);
        const body = await streamToString(result.Body);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': getContentType(key),
                'Access-Control-Allow-Origin': '*'
            },
            body: body
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        // If file not found, serve index.html
        if (error.name === 'NoSuchKey') {
            try {
                const command = new GetObjectCommand({
                    Bucket: 'faceid-auth-1730092800',
                    Key: 'index.html'
                });
                
                const result = await s3Client.send(command);
                const body = await streamToString(result.Body);
                
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/html',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: body
                };
            } catch (indexError) {
                console.error('Index error:', indexError);
                return {
                    statusCode: 500,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ message: 'Error loading page' })
                };
            }
        }
        
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal server error', error: error.message })
        };
    }
};

async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

function getContentType(key) {
    if (key.endsWith('.js')) return 'application/javascript';
    if (key.endsWith('.css')) return 'text/css';
    if (key.endsWith('.html')) return 'text/html';
    if (key.endsWith('.json')) return 'application/json';
    return 'text/plain';
}