import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      image_tests: [] as any[],
      summary: {
        total_tests: 0,
        successful_tests: 0,
        failed_tests: 0,
        average_response_time: 0
      }
    };

    // Test common image paths
    const testImages = [
      {
        name: 'Proxy - Product Image',
        url: '/wp-content/uploads/2024/01/product-sample.jpg',
        type: 'proxy'
      },
      {
        name: 'Direct - Product Image', 
        url: 'https://api.wasgeurtje.nl/wp-content/uploads/2024/01/product-sample.jpg',
        type: 'direct'
      },
      {
        name: 'Proxy - Favicon',
        url: '/wp-content/uploads/2023/favicon.ico',
        type: 'proxy'
      },
      {
        name: 'Direct - Favicon',
        url: 'https://api.wasgeurtje.nl/wp-content/uploads/2023/favicon.ico', 
        type: 'direct'
      },
      {
        name: 'Static - Local Image',
        url: '/figma/productpagina/default-ingredient.png',
        type: 'static'
      }
    ];

    let totalResponseTime = 0;
    let successCount = 0;

    for (const imageTest of testImages) {
      const startTime = Date.now();
      
      try {
        // For server-side image testing, we'll check if the URL responds
        const testUrl = imageTest.type === 'static' 
          ? `${request.nextUrl.origin}${imageTest.url}`
          : imageTest.type === 'proxy'
          ? `${request.nextUrl.origin}${imageTest.url}`
          : imageTest.url;

        console.log(`🖼️ Testing image: ${testUrl}`);

        const response = await fetch(testUrl, {
          method: 'HEAD', // Use HEAD to avoid downloading the full image
          headers: {
            'User-Agent': 'Debug-Tool/1.0'
          }
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        totalResponseTime += responseTime;

        const testResult = {
          ...imageTest,
          success: response.ok,
          status: response.status,
          response_time_ms: responseTime,
          content_type: response.headers.get('content-type'),
          content_length: response.headers.get('content-length'),
          error: null,
          tested_url: testUrl
        };

        if (response.ok) {
          successCount++;
        }

        results.image_tests.push(testResult);
        console.log(`${response.ok ? '✅' : '❌'} ${imageTest.name}: ${response.status} (${responseTime}ms)`);

      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        totalResponseTime += responseTime;

        results.image_tests.push({
          ...imageTest,
          success: false,
          status: 0,
          response_time_ms: responseTime,
          content_type: null,
          content_length: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          tested_url: imageTest.type === 'static' 
            ? `${request.nextUrl.origin}${imageTest.url}`
            : imageTest.type === 'proxy'
            ? `${request.nextUrl.origin}${imageTest.url}`
            : imageTest.url
        });

        console.error(`❌ ${imageTest.name}: ${error}`);
      }
    }

    // Calculate summary
    results.summary = {
      total_tests: testImages.length,
      successful_tests: successCount,
      failed_tests: testImages.length - successCount,
      average_response_time: Math.round(totalResponseTime / testImages.length)
    };

    return NextResponse.json({
      success: true,
      ...results,
      recommendations: generateImageRecommendations(results)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateImageRecommendations(results: any) {
  const recommendations = [];
  const { image_tests, summary } = results;

  // Check overall success rate
  const successRate = (summary.successful_tests / summary.total_tests) * 100;
  
  if (successRate < 50) {
    recommendations.push({
      type: 'error',
      message: `Only ${successRate.toFixed(1)}% of image tests succeeded. There may be serious connectivity issues.`
    });
  } else if (successRate < 80) {
    recommendations.push({
      type: 'warning',
      message: `${successRate.toFixed(1)}% success rate. Some images may load inconsistently.`
    });
  }

  // Check proxy vs direct performance
  const proxyTests = image_tests.filter((test: any) => test.type === 'proxy');
  const directTests = image_tests.filter((test: any) => test.type === 'direct');
  
  if (proxyTests.length > 0 && directTests.length > 0) {
    const proxySuccessRate = (proxyTests.filter((t: any) => t.success).length / proxyTests.length) * 100;
    const directSuccessRate = (directTests.filter((t: any) => t.success).length / directTests.length) * 100;
    
    if (Math.abs(proxySuccessRate - directSuccessRate) > 20) {
      if (proxySuccessRate > directSuccessRate) {
        recommendations.push({
          type: 'info',
          message: 'Proxy images are more reliable than direct images. Keep using proxy.'
        });
      } else {
        recommendations.push({
          type: 'warning',
          message: 'Direct images are more reliable than proxy images. Consider switching to direct image URLs.'
        });
      }
    }
  }

  // Check response times
  if (summary.average_response_time > 2000) {
    recommendations.push({
      type: 'warning',
      message: `Average image response time is ${summary.average_response_time}ms. This may cause slow page loads.`
    });
  }

  // Check for specific failures
  const failedTests = image_tests.filter((test: any) => !test.success);
  if (failedTests.length > 0) {
    recommendations.push({
      type: 'info',
      message: `${failedTests.length} image(s) failed to load. Check the detailed results below.`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'All image tests passed successfully!'
    });
  }

  return recommendations;
}
