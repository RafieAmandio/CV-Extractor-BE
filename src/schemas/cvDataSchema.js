const { z } = require('zod');

// Helper function to validate and clean email
const emailSchema = z
  .string()
  .transform((val) => {
    // If empty or just whitespace, return empty string
    if (!val || val.trim() === '') return '';
    
    // Clean the email string
    const cleaned = val.trim();
    
    // Basic email regex check - more permissive than Zod's default
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(cleaned)) {
      return cleaned;
    }
    
    // If it doesn't match, return empty string instead of failing
    return '';
  })
  .optional();

// Define schema for CV data validation
const cvDataSchema = z.object({
  personalInfo: z.object({
    name: z.string().optional(),
    email: emailSchema,
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    summary: z.string().optional()
  }),
  education: z.array(
    z.object({
      institution: z.string().optional(),
      degree: z.string().optional(),
      field: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      gpa: z.string().optional(),
      description: z.string().optional()
    })
  ).default([]),
  experience: z.array(
    z.object({
      company: z.string().optional(),
      position: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      achievements: z.array(z.string()).default([])
    })
  ).default([]),
  skills: z.array(
    z.object({
      category: z.string().optional(),
      skills: z.array(z.string()).default([])
    })
  ).default([]),
  certifications: z.array(
    z.object({
      name: z.string().optional(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      expires: z.boolean().optional(),
      expirationDate: z.string().optional()
    })
  ).default([]),
  languages: z.array(
    z.object({
      language: z.string().optional(),
      proficiency: z.string().optional()
    })
  ).default([]),
  projects: z.array(
    z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      technologies: z.array(z.string()).default([]),
      url: z.string().optional()
    })
  ).default([]),
  publications: z.array(
    z.object({
      title: z.string().optional(),
      publisher: z.string().optional(),
      date: z.string().optional(),
      authors: z.array(z.string()).default([]),
      url: z.string().optional()
    })
  ).default([]),
  awards: z.array(
    z.object({
      title: z.string().optional(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      description: z.string().optional()
    })
  ).default([]),
  references: z.array(
    z.object({
      name: z.string().optional(),
      position: z.string().optional(),
      company: z.string().optional(),
      contact: z.string().optional(),
      relationship: z.string().optional()
    })
  ).default([])
});

module.exports = {
  cvDataSchema
};
