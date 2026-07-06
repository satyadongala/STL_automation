export type OnFailurePolicy = 'fail' | 'continue' | 'breakLoop';

export type ValueRef =
  | string
  | number
  | boolean
  | null
  | {
      source: 'variable' | 'jsonPath' | 'ui' | 'literal' | 'env';
      path?: string;
      locator?: UiLocator;
    };

export interface UiLocator {
  locatorType: 'css' | 'text' | 'role' | 'testId' | 'xpath' | 'label' | 'placeholder';
  selector: string;
}

export interface ComparisonCondition {
  type: 'comparison';
  left: ValueRef;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'matches' | 'in' | 'exists';
  right?: ValueRef;
}

export interface LogicalCondition {
  type: 'logical';
  op: 'and' | 'or' | 'not';
  conditions: Condition[];
}

export type Condition = ComparisonCondition | LogicalCondition;

export interface IfBranch {
  kind: 'if' | 'elseIf' | 'else';
  condition?: Condition;
  body: WorkflowNode[];
}

export interface WorkflowDefinition {
  schemaVersion: string;
  id: string;
  name: string;
  description?: string;
  defaults?: {
    timeoutMs?: number;
    onFailure?: OnFailurePolicy;
    maxLoopIterations?: number;
  };
  variables?: Record<string, string | number | boolean | null>;
  root: WorkflowNode;
}

export type WorkflowNode =
  | GroupNode
  | StepNode
  | TestCaseRefNode
  | IfNode
  | ForNode
  | ForEachNode
  | WhileNode
  | SetVariableNode;

export interface BaseNode {
  id: string;
  name?: string;
  onFailure?: OnFailurePolicy;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  children: WorkflowNode[];
}

export interface StepNode extends BaseNode {
  type: 'step';
  stepKind: 'api' | 'ui';
  api?: ApiStepConfig;
  ui?: UiStepConfig;
  assertions?: AssertionDef[];
  extractions?: ExtractionDef[];
}

export interface ApiStepConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string | null;
}

export interface UiStepConfig {
  action: string;
  selector?: string;
  value?: string;
  variableName?: string;
  label?: string;
  locatorType?: string;
  methodId?: string;
  params?: Record<string, string>;
}

export interface TestCaseRefNode extends BaseNode {
  type: 'testCaseRef';
  testCaseId: string;
  parameterOverrides?: Record<string, string>;
}

export interface IfNode extends BaseNode {
  type: 'if';
  branches: IfBranch[];
}

export interface ForNode extends BaseNode {
  type: 'for';
  iterator: {
    kind: 'range';
    from: ValueRef;
    to: ValueRef;
    step?: ValueRef;
    indexVariable?: string;
  };
  body: WorkflowNode[];
}

export interface ForEachNode extends BaseNode {
  type: 'forEach';
  iterator: {
    kind: 'collection';
    collection: ValueRef;
    itemVariable?: string;
    indexVariable?: string;
  };
  body: WorkflowNode[];
}

export interface WhileNode extends BaseNode {
  type: 'while';
  condition: Condition;
  maxIterations?: number;
  body: WorkflowNode[];
}

export interface SetVariableNode extends BaseNode {
  type: 'setVariable';
  name: string;
  value: ValueRef;
  scope?: 'loop' | 'workflow' | 'global';
}

export interface AssertionDef {
  type: string;
  expected?: string;
  path?: string;
  operator?: string;
  headerName?: string;
}

export interface ExtractionDef {
  path: string;
  variableName: string;
}

export type StepStatus = 'PASSED' | 'FAILED' | 'SKIPPED';

export interface StepResult {
  status: StepStatus;
  durationMs: number;
  request?: unknown;
  response?: unknown;
  assertionResults?: unknown[];
  errorMessage?: string;
}

export interface LastApiResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: unknown;
}

export interface RuntimeResources {
  apiRequest: import('@playwright/test').APIRequestContext;
  page: import('@playwright/test').Page | null;
  sharedMethods: SharedMethodRecord[];
  baseUrl: string;
  mergedDefaultHeaders: Record<string, string>;
}

export interface SharedMethodRecord {
  id: string;
  name: string;
  parameters: string;
  uiSteps: string;
}
