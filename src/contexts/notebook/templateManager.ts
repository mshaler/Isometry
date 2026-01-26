import type { NotebookTemplate, NotebookCard } from '../../types/notebook';
import { BUILT_IN_TEMPLATES, createNotebookCardTemplate } from '../../types/notebook';
import type { ErrorReporting } from '../../services/ErrorReportingService';

const TEMPLATES_STORAGE_KEY = 'notebook_custom_templates';

export function createTemplateManager(errorReporting: ErrorReporting) {
  // Load templates from localStorage and merge with built-in templates
  const loadTemplates = (): NotebookTemplate[] => {
    try {
      const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const customTemplates: NotebookTemplate[] = savedTemplates ? JSON.parse(savedTemplates) : [];

      // Validate custom templates structure
      const validCustomTemplates = customTemplates.filter(template =>
        template.id && template.name && template.markdownContent !== undefined
      );

      // Merge built-in and custom templates
      return [...BUILT_IN_TEMPLATES, ...validCustomTemplates];
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load custom templates');
      errorReporting.reportUserWarning('Template Loading Failed', 'Using default templates only. Your custom templates could not be loaded.');
      console.warn('Failed to load custom templates:', err);
      return BUILT_IN_TEMPLATES;
    }
  };

  // Save custom templates to localStorage
  const saveCustomTemplates = (customTemplates: NotebookTemplate[]) => {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save custom templates');
      errorReporting.reportUserError('Template Save Failed', 'Your custom template changes could not be saved and may be lost.', [
        {
          label: 'Retry',
          action: () => {
            try {
              localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
              errorReporting.reportUserInfo('Templates Saved', 'Your templates have been saved successfully.');
            } catch {
              errorReporting.reportUserError('Save Failed Again', 'Unable to save templates. Please try again later.');
            }
          }
        },
        {
          label: 'OK',
          action: () => {} // No-op
        }
      ]);
      console.warn('Failed to save custom templates:', err);
    }
  };

  const createTemplate = async (name: string, description: string, fromCard: NotebookCard): Promise<NotebookTemplate> => {
    const template = createNotebookCardTemplate(
      name,
      description,
      fromCard.markdownContent,
      fromCard.properties,
      fromCard.type
    );

    const currentTemplates = loadTemplates();
    const customTemplates = currentTemplates.filter(t => !BUILT_IN_TEMPLATES.includes(t));
    const updatedCustomTemplates = [...customTemplates, template];

    saveCustomTemplates(updatedCustomTemplates);

    return template;
  };

  const deleteTemplate = async (templateId: string): Promise<void> => {
    const currentTemplates = loadTemplates();
    const customTemplates = currentTemplates.filter(t => !BUILT_IN_TEMPLATES.includes(t));
    const updatedCustomTemplates = customTemplates.filter(t => t.id !== templateId);

    saveCustomTemplates(updatedCustomTemplates);
  };

  const updateTemplate = async (templateId: string, updates: Partial<NotebookTemplate>): Promise<void> => {
    const currentTemplates = loadTemplates();
    const customTemplates = currentTemplates.filter(t => !BUILT_IN_TEMPLATES.includes(t));
    const updatedCustomTemplates = customTemplates.map(t =>
      t.id === templateId ? { ...t, ...updates } : t
    );

    saveCustomTemplates(updatedCustomTemplates);
  };

  const duplicateTemplate = async (templateId: string, newName: string): Promise<NotebookTemplate> => {
    const currentTemplates = loadTemplates();
    const originalTemplate = currentTemplates.find(t => t.id === templateId);

    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const duplicatedTemplate = createNotebookCardTemplate(
      newName,
      `Copy of ${originalTemplate.description}`,
      originalTemplate.markdownContent,
      originalTemplate.properties,
      originalTemplate.type
    );

    const customTemplates = currentTemplates.filter(t => !BUILT_IN_TEMPLATES.includes(t));
    const updatedCustomTemplates = [...customTemplates, duplicatedTemplate];

    saveCustomTemplates(updatedCustomTemplates);

    return duplicatedTemplate;
  };

  return {
    loadTemplates,
    saveCustomTemplates,
    createTemplate,
    deleteTemplate,
    updateTemplate,
    duplicateTemplate
  };
}