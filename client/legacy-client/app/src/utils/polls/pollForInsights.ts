interface InsightStatusResponse {
  success: boolean;
  status: 'completed' | 'processing';
  insights?: any;
  message?: string;
}

/**
 * Poll for job completion
 * @param {string} jobId - The job ID to poll for
 * @param {number} timeoutMinutes - Max time to wait (default: 6 minutes)
 * @returns {Promise<any|null>} The insights or null if timeout
 */
export async function pollForInsights(
  jobId: string, 
  timeoutMinutes: number = 6
): Promise<any | null> {
  const startTime = Date.now();
  const maxTime = timeoutMinutes * 60 * 1000;
  let attempt = 0;
  
  while (Date.now() - startTime < maxTime) {
    attempt++;
    
    try {
      const statusRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/market-insights/status/${jobId}`
      );
      
      if (!statusRes.ok) {
        console.warn(`Poll attempt ${attempt} failed with status: ${statusRes.status}`);
      } else {
        const statusData: InsightStatusResponse = await statusRes.json();
        
        if (statusData.status === 'completed' && statusData.insights) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✓ Job completed after ${elapsed}s (${attempt} attempts)`);
          return statusData.insights;
        }
        
        const elapsedMin = Math.floor((Date.now() - startTime) / 60000);
        console.log(`⏳ Attempt ${attempt}: Still processing... (${elapsedMin}m elapsed)`);
      }
      
      // Dynamic interval: first 30s check every 2s, then every 5s
      const interval = (Date.now() - startTime) < 30000 ? 2000 : 5000;
      await sleep(interval);
      
    } catch (err) {
      console.error('Polling error:', err);
      await sleep(3000);
    }
  }
  
  console.error(`Polling timeout after ${timeoutMinutes} minutes`);
  return null;
}

/**
 * Helper to sleep/wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}