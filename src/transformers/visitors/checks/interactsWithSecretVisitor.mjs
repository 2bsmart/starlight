/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { SyntaxUsageError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Visitor looks for secret/public identifiers and marks functions, /
 * expressions, and variables as interactsWithSecret and/or interactsWithPublic
 */

// below visitors will only work with a small subtree - passing a whole AST is not advised!
// useful for subtrees like ExpressionStatements
const markSubtreeInteractsWithSecret = (thisPath, thisState) => {
  const { node, scope } = thisPath;
  if (!['Identifier', 'VariableDeclarationStatement'].includes(node.nodeType))
    return;
  thisPath.interactsWithSecret = true;
  node.interactsWithSecret = true;
  const indicator = scope.getReferencedIndicator(node, true);
  // we don't want to add itself as an interacted with path
  if (indicator && thisState.secretPath.node.id !== node.id)
    indicator.addSecretInteractingPath(thisState.secretPath);
};

const markSubtreeInteractsWithPublic = (thisPath, thisState) => {
  const { node, scope } = thisPath;
  if (!['Identifier', 'VariableDeclarationStatement'].includes(node.nodeType))
    return;
  thisPath.interactsWithPublic = true;
  node.interactsWithPublic = true;
  const indicator = scope.getReferencedIndicator(node, true);
  // we don't want to add itself as an interacted with path
  if (indicator && thisState.publicPath.node.id !== node.id)
    indicator.addPublicInteractingPath(thisState.publicPath);
};

export default {
  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  FunctionCall: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope } = path;
      const expressionPath =
        path.getAncestorOfType('ExpressionStatement') || path.parentPath;
      if (path.isExternalFunctionCall()) {
        path.markContainsPublic();
        // below ensures that the return value and args are marked as interactsWithPublic
        expressionPath.traversePathsFast(markSubtreeInteractsWithPublic, {
          publicPath: path,
        });
      }
    },
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope } = path;
      if (!scope.getReferencedBinding(node)) return;
      const expressionPath =
        path.getAncestorOfType('ExpressionStatement') ||
        path.getAncestorOfType('VariableDeclarationStatement');
      if (scope.getReferencedBinding(node).isSecret) {
        path.markContainsSecret();
        if (expressionPath)
          expressionPath.traversePathsFast(markSubtreeInteractsWithSecret, {
            secretPath: path,
          });
      } else if (scope.getReferencedBinding(node).stateVariable) {
        path.markContainsPublic();
        if (expressionPath)
          expressionPath.traversePathsFast(markSubtreeInteractsWithPublic, {
            publicPath: path,
          });
      }
    },
  },
};
