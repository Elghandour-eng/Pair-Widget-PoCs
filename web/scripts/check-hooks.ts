/**
 * Guards the one rule TypeScript cannot: a hook must not be reached
 * conditionally.
 *
 * A hook placed after an early `return` runs on some renders and not others,
 * which React rejects at runtime with "rendered more hooks than during the
 * previous render" — a minified error number in production, far from the line
 * that caused it. The type checker has nothing to say about it, and this
 * project carries no ESLint, so the check lives here and runs with `npm run
 * lint`.
 *
 * It reports a hook call that sits, at a function's top level, after a `return`
 * at that same level. That is the shape that actually breaks; a hook inside a
 * branch or a loop is a different mistake and is left to review.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

/** `useThing(` — React's own hooks and any custom one, which follow the same rule. */
const isHookCall = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)
      ? callee.name.text
      : ''
  return /^use[A-Z]/.test(name)
}

const hookNameOf = (node: ts.CallExpression): string =>
  ts.isIdentifier(node.expression)
    ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.getText()
      : 'hook'

interface Finding {
  file: string
  line: number
  hook: string
  returnLine: number
}

/** Walks a function body's own statements, ignoring nested functions. */
function checkBody(body: ts.Block, file: ts.SourceFile, out: Finding[]): void {
  let firstReturn: ts.ReturnStatement | undefined

  for (const statement of body.statements) {
    if (firstReturn) {
      // Anything after a top-level return: look for hook calls, but do not
      // descend into functions declared here — those have their own scope.
      const scan = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return
        if (isHookCall(node)) {
          out.push({
            file: path.relative(SRC, file.fileName),
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            hook: hookNameOf(node),
            returnLine: file.getLineAndCharacterOfPosition(firstReturn!.getStart()).line + 1,
          })
        }
        ts.forEachChild(node, scan)
      }
      scan(statement)
      continue
    }

    // A bare `return` ends the unconditional region. A return inside an `if`
    // counts too: it is exactly the early-exit that makes later hooks conditional.
    if (ts.isReturnStatement(statement)) firstReturn = statement
    else if (ts.isIfStatement(statement)) {
      const branch = statement.thenStatement
      const returns = ts.isReturnStatement(branch)
        ? branch
        : ts.isBlock(branch)
          ? branch.statements.find(ts.isReturnStatement)
          : undefined
      if (returns) firstReturn = returns
    }
  }
}

function walk(node: ts.Node, file: ts.SourceFile, out: Finding[]): void {
  if (
    (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
    node.body &&
    ts.isBlock(node.body)
  ) {
    checkBody(node.body, file, out)
  }
  ts.forEachChild(node, (child) => walk(child, file, out))
}

function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) yield* sources(full)
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) yield full
  }
}

const findings: Finding[] = []
for (const filename of sources(SRC)) {
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  walk(source, source, findings)
}

if (findings.length) {
  console.error('Hooks reached only on some renders (React error #310):\n')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.hook}() runs after the return on line ${f.returnLine}`)
  }
  console.error('\nMove every hook above the first return.')
  process.exit(1)
}

console.log('hook order ok')
