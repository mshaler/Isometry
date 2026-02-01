/**
 * Complete GSD Commands - Full Terminal Parity
 *
 * Implements all GSD commands available in Terminal.app workflow
 * Provides complete feature parity for switching from Terminal to Notebook
 */

import { useCallback } from 'react';
import { useGSDv2 } from './useGSDv2';
import { useGSDDatabase } from './useGSDDatabase';
import { useGSDFileManager } from './useGSDFileManager';
import { useGSDGitIntegration } from './useGSDGitIntegration';
import type { GSDCommand } from '../../types/gsd';

export function useGSDCommandsComplete() {
  const gsd = useGSDv2();
  const { getTemplatesFromDb } = useGSDDatabase() || {};
  const fileManager = useGSDFileManager();
  const gitIntegration = useGSDGitIntegration();

  const getAvailableCommands = useCallback((): GSDCommand[] => {
    return [
      // MILESTONE MANAGEMENT
      {
        id: 'new-milestone',
        label: 'New Milestone',
        description: 'Create new milestone structure with phases and requirements',
        slashCommand: '/gsd:new-milestone',
        category: 'planning',
        icon: '🎯',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'list-milestones',
        label: 'List Milestones',
        description: 'Show all available milestones and their status',
        slashCommand: '/gsd:list-milestones',
        category: 'planning',
        icon: '📋',
        requiresInput: false,
        dangerLevel: 'safe',
      },

      // PHASE MANAGEMENT
      {
        id: 'new-project',
        label: 'New Project',
        description: 'Initialize a new GSD project with database persistence',
        slashCommand: '/gsd:new-project',
        category: 'planning',
        icon: '🆕',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'plan-phase',
        label: 'Plan Phase',
        description: 'Create detailed phase plan with requirements and tasks',
        slashCommand: '/gsd:plan-phase',
        category: 'planning',
        icon: '📋',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'execute-phase',
        label: 'Execute Phase',
        description: 'Execute planned phase with checkpoint management',
        slashCommand: '/gsd:execute-phase',
        category: 'execution',
        icon: '⚡',
        requiresInput: false,
        dangerLevel: 'warning',
      },
      {
        id: 'verify-phase',
        label: 'Verify Phase',
        description: 'Run phase verification with quality gates',
        slashCommand: '/gsd:verify-phase',
        category: 'execution',
        icon: '✅',
        requiresInput: false,
        dangerLevel: 'safe',
      },

      // DEVELOPMENT & RESEARCH
      {
        id: 'research',
        label: 'Research Phase',
        description: 'Conduct research with web search and documentation analysis',
        slashCommand: '/gsd:research',
        category: 'research',
        icon: '🔍',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'map-codebase',
        label: 'Map Codebase',
        description: 'Analyze codebase structure and generate documentation',
        slashCommand: '/gsd:map-codebase',
        category: 'research',
        icon: '🗺️',
        requiresInput: false,
        dangerLevel: 'safe',
      },
      {
        id: 'debug',
        label: 'Debug Session',
        description: 'Start debug investigation session with error tracking',
        slashCommand: '/gsd:debug',
        category: 'debug',
        icon: '🐛',
        requiresInput: true,
        dangerLevel: 'warning',
      },

      // INTEGRATION & DEPLOYMENT
      {
        id: 'integrate',
        label: 'Integration Check',
        description: 'Verify integration dependencies and compatibility',
        slashCommand: '/gsd:integrate',
        category: 'execution',
        icon: '🔗',
        requiresInput: false,
        dangerLevel: 'warning',
      },
      {
        id: 'deploy',
        label: 'Deploy Phase',
        description: 'Deploy completed phase with automated testing',
        slashCommand: '/gsd:deploy',
        category: 'execution',
        icon: '🚀',
        requiresInput: false,
        dangerLevel: 'danger',
      },

      // STATE MANAGEMENT
      {
        id: 'save-session',
        label: 'Save Session',
        description: 'Save current session state for later resumption',
        slashCommand: '/gsd:save-session',
        category: 'session',
        icon: '💾',
        requiresInput: false,
        dangerLevel: 'safe',
      },
      {
        id: 'restore-session',
        label: 'Restore Session',
        description: 'Restore previously saved session state',
        slashCommand: '/gsd:restore-session',
        category: 'session',
        icon: '🔄',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'update-state',
        label: 'Update State',
        description: 'Update project state and progress tracking',
        slashCommand: '/gsd:update-state',
        category: 'session',
        icon: '📊',
        requiresInput: false,
        dangerLevel: 'safe',
      },

      // TEMPLATE MANAGEMENT
      {
        id: 'load-template',
        label: 'Load Template',
        description: 'Load a project template from database',
        slashCommand: '/gsd:load-template',
        category: 'planning',
        icon: '📂',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'save-template',
        label: 'Save Template',
        description: 'Save current session as reusable template',
        slashCommand: '/gsd:save-template',
        category: 'planning',
        icon: '💾',
        requiresInput: true,
        dangerLevel: 'safe',
      },
      {
        id: 'create-template',
        label: 'Create Template',
        description: 'Create new project template from scratch',
        slashCommand: '/gsd:create-template',
        category: 'planning',
        icon: '🆕',
        requiresInput: true,
        dangerLevel: 'safe',
      },

      // ANALYTICS & INSIGHTS
      {
        id: 'analytics',
        label: 'View Analytics',
        description: 'Display productivity analytics and velocity metrics',
        slashCommand: '/gsd:analytics',
        category: 'analytics',
        icon: '📈',
        requiresInput: false,
        dangerLevel: 'safe',
      },
      {
        id: 'velocity',
        label: 'Velocity Report',
        description: 'Generate detailed velocity and performance report',
        slashCommand: '/gsd:velocity',
        category: 'analytics',
        icon: '⚡',
        requiresInput: false,
        dangerLevel: 'safe',
      },

      // GIT INTEGRATION
      {
        id: 'commit',
        label: 'Commit Changes',
        description: 'Create GSD-tracked git commit with metadata',
        slashCommand: '/gsd:commit',
        category: 'git',
        icon: '📝',
        requiresInput: true,
        dangerLevel: 'warning',
      },
      {
        id: 'push',
        label: 'Push to Remote',
        description: 'Push committed changes to remote repository',
        slashCommand: '/gsd:push',
        category: 'git',
        icon: '⬆️',
        requiresInput: false,
        dangerLevel: 'warning',
      },
      {
        id: 'create-pr',
        label: 'Create PR',
        description: 'Create pull request with GSD context and history',
        slashCommand: '/gsd:create-pr',
        category: 'git',
        icon: '🔀',
        requiresInput: true,
        dangerLevel: 'warning',
      },

      // FILE MANAGEMENT
      {
        id: 'create-plan',
        label: 'Create Plan File',
        description: 'Create new PLAN.md file for current phase',
        slashCommand: '/gsd:create-plan',
        category: 'files',
        icon: '📄',
        requiresInput: false,
        dangerLevel: 'safe',
      },
      {
        id: 'update-summary',
        label: 'Update Summary',
        description: 'Update SUMMARY.md with current phase progress',
        slashCommand: '/gsd:update-summary',
        category: 'files',
        icon: '📋',
        requiresInput: false,
        dangerLevel: 'safe',
      },
    ];
  }, []);

  const executeById = useCallback(async (commandId: string, input?: string) => {
    const commands = getAvailableCommands();
    const command = commands.find(c => c.id === commandId);

    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    // Route to appropriate handler based on command category
    switch (command.category) {
      case 'planning':
        return await executePlanningCommand(command, input);
      case 'execution':
        return await executeExecutionCommand(command, input);
      case 'research':
        return await executeResearchCommand(command, input);
      case 'debug':
        return await executeDebugCommand(command, input);
      case 'session':
        return await executeSessionCommand(command, input);
      case 'analytics':
        return await executeAnalyticsCommand(command, input);
      case 'git':
        return await executeGitCommand(command, input);
      case 'files':
        return await executeFileCommand(command, input);
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, getAvailableCommands]);

  // Command category handlers
  const executePlanningCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'new-milestone':
        return await fileManager.createMilestone(input || 'New Milestone');
      case 'list-milestones':
        return await fileManager.listMilestones();
      case 'new-project':
        return await fileManager.createProject(input || 'New Project');
      case 'plan-phase':
        return await fileManager.createPhase(input || 'New Phase');
      case 'load-template':
        return await fileManager.loadTemplate(input || '');
      case 'save-template':
        return await fileManager.saveTemplate(input || 'New Template');
      case 'create-template':
        return await fileManager.createTemplate(input || 'New Template');
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeExecutionCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'execute-phase':
        return await fileManager.executePhase();
      case 'verify-phase':
        return await fileManager.verifyPhase();
      case 'integrate':
        return await fileManager.checkIntegration();
      case 'deploy':
        return await fileManager.deployPhase();
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeResearchCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'research':
        return await fileManager.startResearch(input || '');
      case 'map-codebase':
        return await fileManager.mapCodebase();
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeDebugCommand = useCallback(async (command: GSDCommand, input?: string) => {
    return await fileManager.startDebugSession(input || '');
  }, [fileManager]);

  const executeSessionCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'save-session':
        return await fileManager.saveSession();
      case 'restore-session':
        return await fileManager.restoreSession(input || '');
      case 'update-state':
        return await fileManager.updateState();
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeAnalyticsCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'analytics':
        return await fileManager.showAnalytics();
      case 'velocity':
        return await fileManager.generateVelocityReport();
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeGitCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'commit':
        return await gitIntegration.createCommit(input || 'GSD: Phase progress');
      case 'push':
        return await gitIntegration.pushToRemote();
      case 'create-pr':
        return await gitIntegration.createPullRequest(input || 'Phase completion');
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, gitIntegration]);

  const executeFileCommand = useCallback(async (command: GSDCommand, input?: string) => {
    switch (command.id) {
      case 'create-plan':
        return await fileManager.createPlanFile();
      case 'update-summary':
        return await fileManager.updateSummaryFile();
      default:
        return await gsd.executeCommand(command, input);
    }
  }, [gsd, fileManager]);

  const executeSlashCommand = useCallback(async (slashCommand: string, input?: string) => {
    const commands = getAvailableCommands();
    const command = commands.find(c => c.slashCommand === slashCommand);

    if (!command) {
      throw new Error(`Slash command not found: ${slashCommand}`);
    }

    return executeById(command.id, input);
  }, [executeById, getAvailableCommands]);

  const getTemplates = useCallback(async (category?: string) => {
    if (!getTemplatesFromDb) return [];
    return getTemplatesFromDb(category);
  }, [getTemplatesFromDb]);

  const getCommandsByCategory = useCallback((category: string) => {
    return getAvailableCommands().filter(cmd => cmd.category === category);
  }, [getAvailableCommands]);

  return {
    ...gsd,
    executeById,
    executeSlashCommand,
    getAvailableCommands,
    getCommandsByCategory,
    getTemplates,

    // Command category accessors
    planningCommands: getCommandsByCategory('planning'),
    executionCommands: getCommandsByCategory('execution'),
    researchCommands: getCommandsByCategory('research'),
    debugCommands: getCommandsByCategory('debug'),
    sessionCommands: getCommandsByCategory('session'),
    analyticsCommands: getCommandsByCategory('analytics'),
    gitCommands: getCommandsByCategory('git'),
    fileCommands: getCommandsByCategory('files'),
  };
}