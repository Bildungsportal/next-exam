/**
 * pdfjs v4 operator list: constructPath args = [ops:number[], data:number[]] (PDF path opcodes).
 * pdfjs v5+: args = [paintOp:number, [Float32Array flatDrawOps], minMax?] — flat uses DrawOPS 0..4 (see pdf.js makePathFromDrawOPS).
 */

const DRAW = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 };

/** @returns {{ legacy: true, ops: number[], data: number[] } | { legacy: false, flat: ArrayBufferView, paintOp: number, minMax?: unknown } | null} */
export function decodeConstructPathArgs(args) {
    if (!args || !Array.isArray(args)) return null;
    if (Array.isArray(args[0]) && Array.isArray(args[1]) && args[0].length > 0) {
        const first = args[0][0];
        if (first >= 10 || first === 19) {
            return { legacy: true, ops: args[0], data: args[1] };
        }
    }
    if (typeof args[0] === 'number') {
        if (Array.isArray(args[1]) && args[1].length === 1 && ArrayBuffer.isView(args[1][0])) {
            return { legacy: false, flat: args[1][0], paintOp: args[0], minMax: args[2] };
        }
        if (ArrayBuffer.isView(args[1])) {
            return { legacy: false, flat: args[1], paintOp: args[0], minMax: args[2] };
        }
    }
    if (Array.isArray(args[0]) && Array.isArray(args[1])) {
        return { legacy: true, ops: args[0], data: args[1] };
    }
    return null;
}

/**
 * Expand pdfjs 5 draw-op stream to legacy PDF path ops + parallel data array (same as v4 getOperatorList).
 * @param {ArrayBufferView|number[]} flat
 * @param {{ moveTo:number, lineTo:number, curveTo:number, curveTo2:number, curveTo3:number }} opCode
 */
export function flatDrawOpsToLegacyPathOps(flat, opCode) {
    const view = ArrayBuffer.isView(flat) ? flat : new Float32Array(flat);
    const ops = [];
    const data = [];
    let i = 0;
    let curX = 0;
    let curY = 0;
    let subStart = null;
    while (i < view.length) {
        const cmd = view[i++];
        if (cmd === DRAW.moveTo) {
            curX = view[i++];
            curY = view[i++];
            ops.push(opCode.moveTo);
            data.push(curX, curY);
            subStart = { x: curX, y: curY };
        } else if (cmd === DRAW.lineTo) {
            curX = view[i++];
            curY = view[i++];
            ops.push(opCode.lineTo);
            data.push(curX, curY);
        } else if (cmd === DRAW.curveTo) {
            ops.push(opCode.curveTo);
            for (let k = 0; k < 6; k += 1) data.push(view[i++]);
            curX = data[data.length - 2];
            curY = data[data.length - 1];
        } else if (cmd === DRAW.quadraticCurveTo) {
            ops.push(opCode.curveTo2);
            for (let k = 0; k < 4; k += 1) data.push(view[i++]);
            curX = data[data.length - 2];
            curY = data[data.length - 1];
        } else if (cmd === DRAW.closePath) {
            if (subStart) {
                ops.push(opCode.lineTo);
                data.push(subStart.x, subStart.y);
                curX = subStart.x;
                curY = subStart.y;
            }
        } else {
            break;
        }
    }
    return { ops, data };
}
