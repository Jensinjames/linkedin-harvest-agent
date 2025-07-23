// Dependency injection container for better service decoupling
import { storage } from '../storage';
import { ExcelParser } from './excel/parser';
import { ExcelExporter } from './excel/exporter';
import { LinkedInService } from './linkedin-api';
import { AIProfileExtractor } from './ai-profile-extractor';
import { JobSimulator } from './job-simulator';
import { JobQueue } from './job-queue';

interface Services {
  storage: typeof storage;
  excelParser: ExcelParser;
  excelExporter: ExcelExporter;
  linkedinService: LinkedInService;
  aiProfileExtractor: AIProfileExtractor;
  jobSimulator: JobSimulator;
  jobQueue: JobQueue;
}

class DependencyContainer {
  private services: Partial<Services> = {};

  register<K extends keyof Services>(name: K, service: Services[K]): void {
    this.services[name] = service;
  }

  get<K extends keyof Services>(name: K): Services[K] {
    const service = this.services[name];
    if (!service) {
      throw new Error(`Service ${String(name)} not registered`);
    }
    return service;
  }

  registerAll(): void {
    // Register all services
    this.register('storage', storage);
    this.register('excelParser', new ExcelParser());
    this.register('excelExporter', new ExcelExporter());
    
    // These will be updated to use dependency injection
    this.register('linkedinService', this.createLinkedInService());
    this.register('aiProfileExtractor', this.createAIProfileExtractor());
    this.register('jobSimulator', this.createJobSimulator());
    this.register('jobQueue', this.createJobQueue());
  }

  private createLinkedInService(): LinkedInService {
    // Create with dependencies injected
    const service = new LinkedInService();
    return service;
  }

  private createAIProfileExtractor(): AIProfileExtractor {
    const service = new AIProfileExtractor();
    return service;
  }

  private createJobSimulator(): JobSimulator {
    const service = new JobSimulator();
    return service;
  }

  private createJobQueue(): JobQueue {
    // Avoid circular dependency by getting services that are already registered
    const storageService = this.services.storage;
    const excelParserService = this.services.excelParser;
    const aiExtractorService = this.services.aiProfileExtractor;
    
    if (!storageService || !excelParserService || !aiExtractorService) {
      throw new Error('Required services not registered before JobQueue creation');
    }
    
    const service = new JobQueue(
      storageService,
      excelParserService,
      aiExtractorService
    );
    return service;
  }
}

export const container = new DependencyContainer();

// Initialize all services
container.registerAll();