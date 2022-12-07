import { NavDropdown, Form, Button, Modal, Table } from "react-bootstrap";
import { BabyGruMolecule } from "../utils/BabyGruMolecule";
import { BabyGruMap } from "../utils/BabyGruMap";
import { useEffect, useState } from "react";
import { doDownloadText, readTextFile } from "../utils/BabyGruUtils";
import { MenuItem } from "@mui/material";
import "rc-tree/assets/index.css"
import Tree from 'rc-tree';

export const BabyGruHistoryNode = class {
    constructor(parentNode, command) {
        this.command = command
        this.children = []
        if (parentNode) {
            this.key = `${parentNode.key}.${parentNode.children.length}`
            parentNode.children.push(this)
        }
        else {
            this.key = "0"
        }
        if (command) {
            this.title = `${this.key}: ${command.command}`
        }
        else {
            this.title = this.key
        }
    }
}

const rootNode = new BabyGruHistoryNode(null, null, "Root node")
export const initialHistoryState = { rootNode: rootNode, currentNode: rootNode, allNodes: [rootNode] }

export const historyReducer = (oldHistory, change) => {
    if (change.action === "add") {
        const newNode = new BabyGruHistoryNode(oldHistory.currentNode, change.command)
        return { rootNode: oldHistory.rootNode, currentNode: newNode, allNodes: [oldHistory.allNodes.push(newNode)] }
    }
}

export const BabyGruHistoryMenu = (props) => {
    const [showHistory, setShowHistory] = useState(false)
    const [sessionHistory, setSessionHistory] = useState({ rootNode: { title: "Empty", children: [], key: 0 } })

    useEffect(() => {
        console.log('CommandHistory', props.commandHistory)
        if (props.commandHistory && props.commandHistory.rootNode && showHistory) {
            setSessionHistory(props.commandHistory)
        }
    }, [props.commandHistory])

    useEffect(() => {
        console.log('show history changed', showHistory, props.commandHistory)
        if (props.commandHistory && props.commandHistory.rootNode && showHistory) {
            setSessionHistory(props.commandHistory)
        }
    }, [showHistory])

    const executeJournalFiles = (files) => {
        console.log(files)
        for (const source of files) {
            readTextFile(source)
                .then(contents => {
                    const rootNode = JSON.parse(contents)
                    executeSessionHistory(rootNode)
                })
        }
    }

    const executeSessionHistory = (commands) => {
        commands.filter(command => command.returnType === "status").reduce(
            (p, nextCommand) => {
                //console.log(`Redrawing ${style}`, $this.atomsDirty)
                return p.then(() => props.commandCentre.current.cootCommand({
                    returnType: nextCommand.returnType,
                    command: nextCommand.command,
                    commandArgs: nextCommand.commandArgs,
                    changesMolecules: nextCommand.changesMolecules
                })).then(reply => {
                    // If this was a command to read a molecule, then teh corresponding
                    //BabyGruMolecule has to be created
                    if (nextCommand.command === 'shim_read_pdb') {
                        const newMolecule = new BabyGruMolecule(props.commandCentre)
                        newMolecule.molNo = reply.data.result.result
                        newMolecule.cachedAtoms = newMolecule.webMGAtomsFromFileString(
                            nextCommand.commandArgs[0])
                        newMolecule.name = nextCommand.commandArgs[1]
                        newMolecule.centreOn(props.glRef)
                        props.changeMolecules({ action: "Add", item: newMolecule })
                        return newMolecule.fetchIfDirtyAndDraw('CBs', props.glRef, true)
                    }
                    else if (nextCommand.command === 'shim_read_mtz') {
                        const newMap = new BabyGruMap(props.commandCentre)
                        newMap.molNo = reply.data.result.result
                        props.changeMaps({ action: 'Add', newMap })
                        return newMap
                    }
                    return Promise.resolve()
                })
            },
            Promise.resolve()
        ).then(_ => {
            console.log('Done editing', props.glRef.current)
            props.molecules.forEach(molecule => {
                molecule.redraw(props.glRef)
            })
            props.glRef.current.drawScene()
        })
    }

    return <>
        <NavDropdown
            title="History"
            id="history-nav-dropdown"
            style={{display:'flex', alignItems:'center'}}
            show={props.currentDropdownId === props.dropdownId}
            onToggle={() => { props.dropdownId !== props.currentDropdownId ? props.setCurrentDropdownId(props.dropdownId) : props.setCurrentDropdownId(-1) }}>
            <MenuItem variant="success" onClick={(e) => {
                setShowHistory(true)
            }}>Show command history</MenuItem>
            <MenuItem variant="success" onClick={(e) => {
                const json = JSON.stringify(sessionHistory.rootNode, null, 2)
                doDownloadText(json, "BabyGruSession.json")
            }}>Download history</MenuItem>

            <Form.Group style={{ width: '20rem', margin: '0.5rem' }} controlId="uploadJournal" className="mb-3">
                <Form.Label>Execute history</Form.Label>
                <Form.Control type="file" accept=".json" multiple={true} onChange={(e) => {
                    executeJournalFiles(e.target.files)
                }} />
            </Form.Group>

        </NavDropdown>
        <Modal size="xl" show={showHistory} onHide={() => { setShowHistory(false) }}>
            <Modal.Header closeButton>
                <Modal.Title>Command history</Modal.Title>
            </Modal.Header>
            <Tree
                defaultExpandAll={true}
                height={200}
                itemHeight={20}
                style={{ border: '1px solid #000' }}
                treeData={[sessionHistory.rootNode]}
            />
            <Modal.Footer><Button onClick={() => {
                executeSessionHistory(sessionHistory.commands)
            }}>Replay</Button></Modal.Footer>
        </Modal>
    </>
}