const { z } = require('zod');

// Define schema for CV data validation
const cvDataSchema = z.object({
  personalInfo: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
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
  ).optional(),
  experience: z.array(
    z.object({
      company: z.string().optional(),
      position: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      achievements: z.array(z.string()).optional()
    })
  ).optional(),
  skills: z.array(
    z.object({
      category: z.string().optional(),
      skills: z.array(z.string()).optional()
    })
  ).optional(),
  certifications: z.array(
    z.object({
      name: z.string().optional(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      expires: z.boolean().optional(),
      expirationDate: z.string().optional()
    })
  ).optional(),
  languages: z.array(
    z.object({
      language: z.string().optional(),
      proficiency: z.string().optional()
    })
  ).optional(),
  projects: z.array(
    z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      technologies: z.array(z.string()).optional(),
      url: z.string().optional()
    })
  ).optional(),
  publications: z.array(
    z.object({
      title: z.string().optional(),
      publisher: z.string().optional(),
      date: z.string().optional(),
      authors: z.array(z.string()).optional(),
      url: z.string().optional()
    })
  ).optional(),
  awards: z.array(
    z.object({
      title: z.string().optional(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      description: z.string().optional()
    })
  ).optional(),
  references: z.array(
    z.object({
      name: z.string().optional(),
      position: z.string().optional(),
      company: z.string().optional(),
      contact: z.string().optional(),
      relationship: z.string().optional()
    })
  ).optional()
});

module.exports = {
  cvDataSchema
};
