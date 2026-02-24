// Netlify serverless function for client-side dev logging
// This replicates the /_dev/log endpoint from server.js

export async function handler(event, context) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const payload = JSON.parse(event.body || '{}')
    const tag = String(payload.tag || '')
    
    // Log for debugging (visible in Netlify function logs)
    const shouldLog = process.env.NODE_ENV === 'development' || 
                     process.env.DEV_LOG === '1' || 
                     tag.startsWith('test-') || 
                     tag.includes('craft') || 
                     tag.startsWith('dev')
    
    if (shouldLog) {
      console.log('[DEV LOG]', payload.tag || 'client', payload.message || payload)
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: true })
    }
  } catch (err) {
    console.error('Failed to process dev log:', err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: false, error: err.message })
    }
  }
}
