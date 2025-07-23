import { faker } from '@faker-js/faker';

interface MockProfile {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  industry: string;
  location: string;
  currentPosition?: string;
  currentCompany?: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    year: string;
  }>;
  email?: string;
  phone?: string;
  connections?: number;
  profilePicture?: string;
}

export class MockProfileGenerator {
  private readonly industries = [
    'Technology', 'Finance', 'Healthcare', 'Education', 'Marketing',
    'Sales', 'Engineering', 'Consulting', 'Real Estate', 'Manufacturing',
    'Retail', 'Hospitality', 'Legal', 'Media', 'Non-profit'
  ];

  private readonly skills = {
    technology: ['JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker', 'Machine Learning', 'SQL', 'Git', 'Agile'],
    marketing: ['SEO', 'Content Marketing', 'Social Media', 'Google Analytics', 'Email Marketing', 'PPC', 'Brand Strategy', 'CRM'],
    sales: ['B2B Sales', 'CRM', 'Lead Generation', 'Negotiation', 'Account Management', 'Sales Strategy', 'Cold Calling'],
    finance: ['Financial Analysis', 'Excel', 'Financial Modeling', 'Risk Management', 'Budgeting', 'SAP', 'QuickBooks'],
    general: ['Leadership', 'Communication', 'Project Management', 'Problem Solving', 'Team Building', 'Strategic Planning']
  };

  private readonly companies = {
    technology: ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Tesla', 'Oracle', 'IBM', 'Salesforce'],
    finance: ['JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'Bank of America', 'Wells Fargo', 'Citi', 'BlackRock'],
    consulting: ['McKinsey', 'Bain & Company', 'BCG', 'Deloitte', 'PwC', 'EY', 'KPMG', 'Accenture'],
    general: ['Walmart', 'ExxonMobil', 'Berkshire Hathaway', 'UnitedHealth', 'Johnson & Johnson', 'Procter & Gamble']
  };

  private readonly universities = [
    'Harvard University', 'Stanford University', 'MIT', 'Yale University', 'Princeton University',
    'Columbia University', 'University of Pennsylvania', 'UC Berkeley', 'UCLA', 'NYU',
    'University of Michigan', 'University of Texas', 'Georgia Tech', 'Carnegie Mellon'
  ];

  generateProfileFromUrl(linkedinUrl: string): MockProfile {
    // Extract username from URL for consistent generation
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    const username = match ? match[1] : 'unknown';
    
    // Use username as seed for consistent data
    faker.seed(this.hashCode(username));
    
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const industry = faker.helpers.arrayElement(this.industries);
    const yearsOfExperience = faker.number.int({ min: 1, max: 25 });
    
    return {
      firstName,
      lastName,
      headline: this.generateHeadline(industry, yearsOfExperience),
      summary: this.generateSummary(firstName, industry, yearsOfExperience),
      industry,
      location: `${faker.location.city()}, ${faker.location.state()}`,
      currentPosition: this.generatePosition(yearsOfExperience),
      currentCompany: this.generateCompany(industry),
      skills: this.generateSkills(industry),
      experience: this.generateExperience(industry, yearsOfExperience),
      education: this.generateEducation(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      phone: faker.phone.number(),
      connections: faker.number.int({ min: 50, max: 500 }),
      profilePicture: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=0077B5&color=fff`
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private generateHeadline(industry: string, yearsOfExperience: number): string {
    const level = yearsOfExperience < 3 ? 'Junior' : yearsOfExperience < 8 ? '' : 'Senior';
    const roles = {
      Technology: ['Software Engineer', 'Product Manager', 'Data Scientist', 'DevOps Engineer'],
      Marketing: ['Marketing Manager', 'Digital Marketing Specialist', 'Brand Manager', 'Content Strategist'],
      Sales: ['Sales Manager', 'Account Executive', 'Business Development Manager', 'Sales Director'],
      Finance: ['Financial Analyst', 'Investment Banker', 'CFO', 'Portfolio Manager'],
      Healthcare: ['Physician', 'Nurse Practitioner', 'Healthcare Administrator', 'Medical Director']
    };
    
    const industryRoles = roles[industry as keyof typeof roles] || ['Professional', 'Manager', 'Specialist', 'Consultant'];
    const role = faker.helpers.arrayElement(industryRoles);
    
    return `${level} ${role}`.trim();
  }

  private generateSummary(firstName: string, industry: string, years: number): string {
    return `Experienced ${industry.toLowerCase()} professional with ${years}+ years of proven track record. ` +
           `Passionate about delivering innovative solutions and driving business growth. ` +
           `Strong expertise in ${faker.helpers.arrayElements(this.skills.general, 3).join(', ')}. ` +
           `Currently seeking opportunities to leverage my skills and contribute to organizational success.`;
  }

  private generatePosition(years: number): string {
    if (years < 3) return faker.helpers.arrayElement(['Associate', 'Analyst', 'Coordinator', 'Specialist']);
    if (years < 8) return faker.helpers.arrayElement(['Manager', 'Senior Analyst', 'Team Lead', 'Consultant']);
    if (years < 15) return faker.helpers.arrayElement(['Senior Manager', 'Director', 'Principal', 'VP']);
    return faker.helpers.arrayElement(['Senior Director', 'EVP', 'Partner', 'Chief Officer']);
  }

  private generateCompany(industry: string): string {
    const industryCompanies = this.companies[industry.toLowerCase() as keyof typeof this.companies] || this.companies.general;
    return faker.helpers.arrayElement(industryCompanies);
  }

  private generateSkills(industry: string): string[] {
    const industrySkills = this.skills[industry.toLowerCase() as keyof typeof this.skills] || this.skills.general;
    const generalSkills = faker.helpers.arrayElements(this.skills.general, 3);
    const specificSkills = faker.helpers.arrayElements(industrySkills, 5);
    return Array.from(new Set([...specificSkills, ...generalSkills]));
  }

  private generateExperience(industry: string, totalYears: number): MockProfile['experience'] {
    const experiences = [];
    let remainingYears = totalYears;
    const numPositions = Math.min(4, Math.ceil(totalYears / 3));
    
    for (let i = 0; i < numPositions && remainingYears > 0; i++) {
      const yearsInPosition = Math.min(remainingYears, faker.number.int({ min: 1, max: 5 }));
      const endYear = new Date().getFullYear() - (totalYears - remainingYears);
      const startYear = endYear - yearsInPosition;
      
      experiences.push({
        title: this.generatePosition(totalYears - remainingYears + yearsInPosition),
        company: this.generateCompany(industry),
        duration: `${startYear} - ${i === 0 ? 'Present' : endYear}`,
        description: `Led ${faker.helpers.arrayElement(['cross-functional', 'high-performing', 'distributed'])} teams to ` +
                    `${faker.helpers.arrayElement(['deliver', 'implement', 'optimize'])} ` +
                    `${faker.helpers.arrayElement(['innovative solutions', 'strategic initiatives', 'business objectives'])}. ` +
                    `Achieved ${faker.number.int({ min: 10, max: 50 })}% improvement in ` +
                    `${faker.helpers.arrayElement(['efficiency', 'revenue', 'customer satisfaction', 'productivity'])}.`
      });
      
      remainingYears -= yearsInPosition;
    }
    
    return experiences;
  }

  private generateEducation(): MockProfile['education'] {
    const degrees = ['Bachelor of Science', 'Bachelor of Arts', 'Master of Science', 'MBA', 'PhD'];
    const fields = ['Computer Science', 'Business Administration', 'Engineering', 'Economics', 'Marketing', 'Finance'];
    
    return [{
      school: faker.helpers.arrayElement(this.universities),
      degree: faker.helpers.arrayElement(degrees),
      field: faker.helpers.arrayElement(fields),
      year: (new Date().getFullYear() - faker.number.int({ min: 5, max: 20 })).toString()
    }];
  }
}

export const mockProfileGenerator = new MockProfileGenerator();