export interface VectorizerAIConfig {
  apiId: string;
  apiSecret: string;
  apiUrl?: string;
}

export interface VectorizerAIError {
  status: number;
  code: number;
  message: string;
}

export interface VectorizeOptions {
  mode?: 'production' | 'preview' | 'test' | 'test_preview';
  outputFormat?: 'svg' | 'png' | 'pdf' | 'eps' | 'dxf';
  maxColors?: number;
  retentionDays?: number;
  inputMaxPixels?: number;
  processingOptions?: {
    maxColors?: number;
    palette?: string;
    shapesMinAreaPx?: number;
  };
  outputOptions?: {
    svg?: {
      version?: 'svg_1_0' | 'svg_1_1' | 'svg_tiny_1_2';
      fixedSize?: boolean;
      adobeCompatibilityMode?: boolean;
    };
    size?: {
      scale?: number;
      width?: number;
      height?: number;
      unit?: 'none' | 'px' | 'pt' | 'in' | 'cm' | 'mm';
    };
  };
}

export interface VectorizeResult {
  data: Buffer;
  contentType: string;
  imageToken?: string;
  receipt?: string;
  creditsCharged: number;
  creditsCalculated?: number;
}

export class VectorizerAI {
  private config: VectorizerAIConfig;
  
  constructor(config: VectorizerAIConfig) {
    this.config = {
      apiUrl: 'https://api.vectorizer.ai/api/v1',
      ...config,
    };
  }

  private getAuthHeader(): string {
    const credentials = `${this.config.apiId}:${this.config.apiSecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  private async makeRequest(
    endpoint: string, 
    formData: FormData,
    options?: VectorizeOptions
  ): Promise<VectorizeResult> {
    try {
      const response = await fetch(`${this.config.apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
        body: formData,
      });

      if (!response.ok) {
        let errorData: VectorizerAIError;
        try {
          const errorJson = await response.json();
          errorData = errorJson.error || {
            status: response.status,
            code: 0,
            message: response.statusText,
          };
        } catch {
          errorData = {
            status: response.status,
            code: 0,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        throw new Error(`Vectorizer.AI API error: ${errorData.message} (Code: ${errorData.code})`);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      return {
        data: Buffer.from(data),
        contentType,
        imageToken: response.headers.get('X-Image-Token') || undefined,
        receipt: response.headers.get('X-Receipt') || undefined,
        creditsCharged: parseFloat(response.headers.get('X-Credits-Charged') || '0'),
        creditsCalculated: response.headers.get('X-Credits-Calculated') 
          ? parseFloat(response.headers.get('X-Credits-Calculated')!)
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Vectorizer.AI request failed: ${String(error)}`);
    }
  }

  private buildFormData(options: VectorizeOptions = {}): FormData {
    const formData = new FormData();
    
    // Set mode
    if (options.mode) {
      formData.append('mode', options.mode);
    }

    // Set output format
    if (options.outputFormat) {
      formData.append('output.file_format', options.outputFormat);
    }

    // Set retention policy
    if (options.retentionDays !== undefined) {
      formData.append('policy.retention_days', options.retentionDays.toString());
    }

    // Set input max pixels
    if (options.inputMaxPixels) {
      formData.append('input.max_pixels', options.inputMaxPixels.toString());
    }

    // Processing options
    if (options.processingOptions?.maxColors) {
      formData.append('processing.max_colors', options.processingOptions.maxColors.toString());
    }
    if (options.processingOptions?.palette) {
      formData.append('processing.palette', options.processingOptions.palette);
    }
    if (options.processingOptions?.shapesMinAreaPx) {
      formData.append('processing.shapes.min_area_px', options.processingOptions.shapesMinAreaPx.toString());
    }

    // SVG output options
    if (options.outputOptions?.svg?.version) {
      formData.append('output.svg.version', options.outputOptions.svg.version);
    }
    if (options.outputOptions?.svg?.fixedSize !== undefined) {
      formData.append('output.svg.fixed_size', options.outputOptions.svg.fixedSize.toString());
    }
    if (options.outputOptions?.svg?.adobeCompatibilityMode !== undefined) {
      formData.append('output.svg.adobe_compatibility_mode', options.outputOptions.svg.adobeCompatibilityMode.toString());
    }

    // Size options
    if (options.outputOptions?.size?.scale) {
      formData.append('output.size.scale', options.outputOptions.size.scale.toString());
    }
    if (options.outputOptions?.size?.width) {
      formData.append('output.size.width', options.outputOptions.size.width.toString());
    }
    if (options.outputOptions?.size?.height) {
      formData.append('output.size.height', options.outputOptions.size.height.toString());
    }
    if (options.outputOptions?.size?.unit) {
      formData.append('output.size.unit', options.outputOptions.size.unit);
    }

    return formData;
  }

  async vectorizeFromUrl(imageUrl: string, options: VectorizeOptions = {}): Promise<VectorizeResult> {
    const formData = this.buildFormData(options);
    formData.append('image.url', imageUrl);
    
    return this.makeRequest('vectorize', formData, options);
  }

  async vectorizeFromBuffer(imageBuffer: Buffer, filename: string, options: VectorizeOptions = {}): Promise<VectorizeResult> {
    const formData = this.buildFormData(options);
    formData.append('image', new Blob([imageBuffer]), filename);
    
    return this.makeRequest('vectorize', formData, options);
  }

  async vectorizeFromBase64(base64Data: string, options: VectorizeOptions = {}): Promise<VectorizeResult> {
    const formData = this.buildFormData(options);
    formData.append('image.base64', base64Data);
    
    return this.makeRequest('vectorize', formData, options);
  }

  async vectorizeFromSlackFile(
    slackFileUrl: string, 
    slackBotToken: string, 
    options: VectorizeOptions = {}
  ): Promise<VectorizeResult> {
    try {
      // Fetch the file from Slack
      const response = await fetch(slackFileUrl, {
        headers: {
          'Authorization': `Bearer ${slackBotToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Slack file: ${response.status} ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const filename = slackFileUrl.split('/').pop() || 'image.jpg';
      
      return this.vectorizeFromBuffer(imageBuffer, filename, options);
    } catch (error) {
      throw new Error(`Failed to vectorize Slack file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAccountStatus(): Promise<{
    subscriptionPlan: string;
    subscriptionState: string;
    credits: number;
  }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/account`, {
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get account status: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get account status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Create a singleton instance
export const vectorizerAI = new VectorizerAI({
  apiId: process.env.VECTORIZER_AI_API_ID!,
  apiSecret: process.env.VECTORIZER_AI_API_SECRET!,
});