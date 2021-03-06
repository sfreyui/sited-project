import React from "react";
import {Button, MessageBox} from "element-react";
import ReactGridLayout from "react-grid-layout";
import PropTypes from "prop-types";
import uuid from "react-native-uuid";
import DefaultComponent from "./component.default";
import ErrorComponent from "./component.error";
import TemplateGridEditor from "./template.grid.editor";
import "../../node_modules/react-grid-layout/css/styles.css";
import "../../node_modules/react-resizable/css/styles.css";

import "./template.grid.css";
import ComponentSelector from "./component-selector";

const bundle = window.app.bundle("pageBundle");

const i18n = window.i18n;

export default class LayoutGridEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sections: props.sections ? props.sections : [],
            sectionMap: {},
            layout: [],
            layoutComponents: {},
            componentOptions: [],
            onChange: props.onChange,
            dom: null,
            rowHeight: 10,
            domHeights: {},
            componentHeights: {}
        };
        fetch("/admin/api/page/component/section", {method: "GET"}).then((response) => {
            const componentOptions = response;
            for (let i = 0; i < componentOptions.length; i += 1) {
                const component = window.app.bundle("pageBundle").component(componentOptions[i].componentName);
                if (component) {
                    componentOptions[i].component = component;
                }
            }
            this.setState({componentOptions});
        });
    }

    componentWillMount() {
        const layout = this.fromTemplate(this.state.sections);
        this.setState({layout});
    }

    onLayoutChange(layout) {
        try {
            const templateSections = this.toTemplateSections(layout, 12);
            const sections = templateSections.map(section => this.toLayoutSection(section));

            for (let i = 0; i < sections.length; i += 1) {
                const section = sections[i];
                if (section.components && section.components.length === 1) {
                    const component = this.component(section.components[0].name);
                    if (component) {
                        section.name = component.componentName;
                    } else {
                        section.name = section.components[0].name;
                    }
                } else {
                    section.name = "section";
                }
            }

            this.state.onChange(sections);
        } catch (e) {
            window.console.error(e);
        }
        this.setState({layout});
    }

    toLayoutSection(section) {
        const layoutSection = Object.assign({}, {
            id: section.i,
            components: this.state.layoutComponents[section.i],
            children: section.children.map(child => this.toLayoutSection(child)),
            wrapper: section.wrapper
        });
        if (this.getSection(layoutSection.id) && this.getSection(layoutSection.id).widths) {
            layoutSection.widths = this.getSection(layoutSection.id).widths.filter(width => width.screenWidth !== "lg");
        } else {
            layoutSection.widths = [
                {
                    screenWidth: "xs",
                    width: 12
                },
                {
                    screenWidth: "sm",
                    width: 12
                },
                {
                    screenWidth: "md",
                    width: 12
                }
            ];
        }
        layoutSection.widths.push({
            screenWidth: "lg",
            x: section.x,
            y: section.y,
            width: section.w,
            height: section.h
        });
        this.putSection(layoutSection);
        return layoutSection;
    }

    getSection(sectionId) {
        return this.state.sectionMap[sectionId];
    }

    putSection(section) {
        const sectionMap = this.state.sectionMap;
        sectionMap[section.id] = section;
        this.setState({sectionMap});
    }

    toTemplateSections(layoutSections, columns) {
        const templateSections = [];
        let wrappers = [];
        const sections = this.sort(layoutSections);

        for (let i = 0; i < sections.length;) {
            const sameYSections = this.sameY(i, sections);
            if (this.isFullWidth(sameYSections, columns) || i === 0) { // Or first row
                const wrapper = this.createWrapper(sameYSections, null);
                templateSections.push(wrapper);
                wrappers = wrapper.children.length ? wrapper.children : [wrapper];
            } else {
                const matchedWrappers = this.findWrappers(sameYSections, wrappers);
                if (matchedWrappers.length === wrappers.length) { // new row
                    const wrapper = this.createWrapper(sameYSections, null);
                    templateSections.push(wrapper);
                    wrappers = wrapper.children.length ? wrapper.children : [wrapper];
                } else if (matchedWrappers.length === 1) {
                    const parent = matchedWrappers[0].parent;
                    const parentWrapper = this.wrap(matchedWrappers, parent);
                    const childWrapper = this.createWrapper(sameYSections, parentWrapper);
                    parentWrapper.children.push(childWrapper);
                    this.replaceChildren(parent, matchedWrappers, [parentWrapper]);
                } else {
                    const parent = matchedWrappers[0].parent;
                    const parentWrapper = this.wrap(matchedWrappers, parent);
                    const matchedChildWrapper = this.wrap(matchedWrappers, parentWrapper);
                    const childWrapper = this.createWrapper(sameYSections, parentWrapper);
                    parentWrapper.children = [matchedChildWrapper, childWrapper];

                    this.replaceChildren(parent, matchedWrappers, [parentWrapper]);
                    wrappers = this.replaceWrapper(wrappers, matchedWrappers, parentWrapper);
                }
            }
            i += sameYSections.length;
        }
        return templateSections;
    }

    fromTemplate(sections) {
        const sectionMap = this.state.sectionMap;
        let layoutSections = [];
        for (let i = 0; i < sections.length; i += 1) {
            const section = sections[i];
            sectionMap[section.id] = section;
            if (section.wrapper || section.children.length > 0) {
                layoutSections = layoutSections.concat(this.fromTemplate(section.children));
            } else {
                const layoutComponents = this.state.layoutComponents;
                layoutComponents[section.id] = section.components;
                this.setState({layoutComponents});
                const layoutSection = {
                    i: section.id,
                    x: 0,
                    y: 0,
                    w: 12,
                    h: 4,
                    minH: 4,
                    widths: section.widths
                };
                const width = this.getScreenWidth(section.widths, "lg");
                if (width) {
                    Object.assign(layoutSection, {
                        x: width.x ? width.x : 0,
                        y: width.y ? width.y : 0,
                        w: width.width ? width.width : 12,
                        h: width.height ? width.height : 4
                    });
                }
                layoutSections.push(layoutSection);
            }
        }
        this.setState({sectionMap});
        return layoutSections;
    }

    getScreenWidth(widths, name) {
        for (let j = 0; j < widths.length; j += 1) {
            if (widths[j].screenWidth === name) {
                return widths[j];
            }
        }
    }

    createWrapper(layoutSections, parent) {
        if (layoutSections.length === 1) {
            return {
                i: layoutSections[0].i,
                wrapper: false,
                children: [],
                parent: parent,
                x: layoutSections[0].x,
                w: layoutSections[0].w,
                y: layoutSections[0].y,
                h: layoutSections[0].h,
                minH: 4
            };
        }
        const end = layoutSections[layoutSections.length - 1].x + layoutSections[layoutSections.length - 1].w;
        const wrapper = {
            i: uuid.v4(),
            wrapper: true,
            children: [],
            parent: parent,
            x: layoutSections[0].x,
            w: end - layoutSections[0].x,
            y: layoutSections[0].y,
            h: layoutSections[0].h,
            minH: 4
        };
        wrapper.children = layoutSections.map(section => this.toSection(section, wrapper));
        return wrapper;
    }

    wrap(wrappers, parent) {
        if (wrappers.length === 1 && wrappers[0].wrapper) {
            return wrappers[0];
        }
        const end = wrappers[wrappers.length - 1].x + wrappers[wrappers.length - 1].w;
        const wrapper = {
            i: uuid.v4(),
            wrapper: true,
            children: [],
            parent: parent,
            x: wrappers[0].x,
            w: end - wrappers[0].x,
            y: wrappers[0].y,
            h: wrappers[0].h,
            minH: 4
        };
        wrapper.children = wrappers.map((current) => {
            current.parent = wrapper;
            return current;
        });
        return wrapper;
    }

    toSection(layoutSection, parent) {
        return {
            i: layoutSection.i,
            parent: parent,
            wrapper: false,
            children: [],
            x: layoutSection.x,
            y: layoutSection.y,
            w: layoutSection.w,
            h: layoutSection.h,
            minH: 4
        };
    }

    sameY(start, sections) {
        const y = sections[start].y;
        const sameYSections = [];
        for (let i = start; i < sections.length; i += 1) {
            if (sections[i].y === y) {
                sameYSections.push(sections[i]);
            } else {
                break;
            }
        }
        return sameYSections;
    }

    isFullWidth(sections, columns) {
        const totalWidth = sections.reduce((section, sum) => section.w + sum, 0);
        return totalWidth === columns;
    }

    sort(layout) {
        for (let i = 0; i < layout.length - 1; i += 1) {
            let index = i;
            for (let j = i + 1; j < layout.length; j += 1) {
                const section = layout[j];
                if (section.y < layout[index].y) {
                    index = j;
                } else if (section.y === layout[index].y && section.x < layout[index].x) {
                    index = j;
                }
            }

            const value = layout[i];
            layout[i] = layout[index];
            layout[index] = value;
        }
        return layout;
    }

    findWrappers(group, wrappers) {
        const matchedWrappers = [];
        const startX = group[0].x;
        const endX = group[group.length - 1].x + group[group.length - 1].w;
        for (let i = 0; i < wrappers.length; i += 1) {
            const wrapper = wrappers[i];
            if (wrapper.x >= startX && wrapper.x < endX) {
                matchedWrappers.push(wrapper);
            } else if (wrapper.x + wrapper.w > startX && wrapper.x + wrapper.w <= endX) {
                matchedWrappers.push(wrapper);
            }
        }
        return matchedWrappers;
    }

    replaceChildren(parent, children, target) {
        for (let i = 0; i < parent.children.length; i += 1) {
            if (parent.children[i] === children[0]) {
                parent.children.splice(i, children.length, ...target);
            }
        }
    }

    setParent(sections, parent) {
        for (let i = 0; i < sections.length; i += 1) {
            sections[i].parent = parent;
        }
    }

    replaceWrapper(wrappers, matchedWrapper, wrapper) {
        for (let i = 0; i < wrappers.length; i += 1) {
            if (wrappers[i] === matchedWrapper[0]) {
                wrappers.splice(i, matchedWrapper.length, wrapper);
            }
        }
    }

    removeSection(sectionId) {
        MessageBox.confirm(i18n.t("page.gridDeleteConfirm"), i18n.t("page.warning"), {type: "error"}).then(() => {
            const layout = this.state.layout;
            this.setState({layout: layout.filter(section => section.i !== sectionId)});
        });
    }

    selectComponent(component) {
        const layout = this.state.layout;
        let y = 0;
        layout.map((section) => {
            if (section.y + section.h > y) {
                y = section.y + section.h;
            }
        });
        const grid = {
            i: uuid.v4(),
            x: 0,
            y: y + 1,
            w: 12,
            h: 4,
            minH: 4
        };
        const layoutComponents = this.state.layoutComponents;
        layoutComponents[grid.i] = [component];
        this.setState({
            layout: this.state.layout.concat([grid]),
            layoutComponents
        });
    }

    renderComponent(componentValue, section) {
        const component = this.component(componentValue.name);
        if (component) {
            if (component.component) {
                return React.createElement(component.component, {
                    component: componentValue,
                    readOnly: this.state.readOnly,
                    style: {height: this.state.componentHeights[section.i]},
                    ref: () => {
                        if (!this.state.domHeights[section.i]) {
                            return;
                        }
                        const domHeight = this.state.domHeights[section.i];
                        const minH = parseInt(domHeight / (this.state.rowHeight + 10), 10) + 1;
                        if (!isNaN(minH)) {
                            if (!section.minH || minH > section.minH) {
                                section.minH = minH;
                                section.h = minH;
                                const componentHeights = this.state.componentHeights;
                                componentHeights[section.i] = minH * (this.state.rowHeight + 10);
                                this.setState({layout: this.state.layout.filter(child => child.i !== section.i)}, () => {
                                    this.setState({
                                        layout: this.state.layout.filter(child => child.i !== section.i).concat([section]),
                                        componentHeights
                                    });
                                });
                            }
                        }
                    }
                });
            }
            return <DefaultComponent component={componentValue}/>;
        }
        return <ErrorComponent component={componentValue}/>;
    }

    component(name) {
        for (let i = 0; i < this.state.componentOptions.length; i += 1) {
            const component = this.state.componentOptions[i];
            if (name === component.name) {
                return component;
            }
        }
        return null;
    }

    isComponentEditable(name) {
        const component = this.component(name);
        return component && component.component && !component.savedComponent;
    }

    updateComponent(component) {
        const layoutComponents = this.state.layoutComponents;
        layoutComponents[this.state.editingSectionId] = [component];
        this.setState({
            layoutComponents,
            editingComponentId: null
        });
    }

    editComponent() {
        const component = this.state.layoutComponents[this.state.editingSectionId][0];
        return React.createElement(bundle.component(component.name), {
            component: component,
            readOnly: this.state.readOnly,
            mode: "edit",
            onChange: value => this.updateComponent(value)
        });
    }

    componentDisplayName(component) {
        if (component.displayName) {
            return component.displayName;
        }
        const comp = this.component(component.name);
        if (comp && comp.displayName) {
            return comp.displayName;
        }
        return component.name;
    }

    updateSection(updatingSection) {
        const section = this.getSection(this.state.updatingSectionId);
        if (section.id === updatingSection.id) {
            section.widths = updatingSection.widths;
            section.name = updatingSection.name;
            this.putSection(section);
            this.setState({updatingSectionId: null});
        }
    }

    cancelCreate() {
        this.setState({updatingSectionId: null});
    }

    onResize(layout, oldItem, newItem) {
        this.setState({
            currentI: newItem.i,
            currentWidth: newItem.w
        });
    }

    onResizeStop() {
        this.setState({
            currentI: null,
            currentWidth: 0
        });
    }

    render() {
        return (
            <div ref={dom => !this.state.dom && this.setState({dom})}>
                <div className="page-grid-editor__component-container">
                    {this.state.editingComponentId && this.state.editingSectionId &&
                    this.editComponent()
                    }
                </div>
                <div className="page-grid-editor__header">
                    <ComponentSelector componentOptions={this.state.componentOptions}
                        onSelect={component => this.selectComponent(component)}/>
                </div>
                {
                    this.state.componentOptions.length &&
                    <ReactGridLayout
                        verticalCompact={true}
                        className="layout"
                        layout={this.state.layout}
                        containerPadding={[0, 10]}
                        rowHeight={this.state.rowHeight}
                        width={this.state.dom && this.state.dom.offsetWidth}
                        onLayoutChange={layout => this.onLayoutChange(layout)}
                        onResize={(layout, oldItem, newItem) => this.onResize(layout, oldItem, newItem)}
                        onResizeStop={() => this.onResizeStop()}
                        cols={12}>
                        {this.state.layout.map((section, index) =>
                            <div key={section.i} className="page-grid-editor__grid">
                                {this.state.currentI === section.i &&
                                <div className="page-grid-editor__ruler" data-width={this.state.currentWidth}></div>
                                }
                                <div ref={(dom) => {
                                    if (!dom) {
                                        return;
                                    }
                                    if (!this.state.domHeights[section.i]) {
                                        const domHeights = this.state.domHeights;
                                        domHeights[section.i] = dom.offsetHeight;
                                        this.setState({domHeights});
                                    }
                                }}
                                >
                                    <div className="page-grid-editor__grid-header">
                                        <span className="page-grid-editor__grid-header-title">{this.componentDisplayName(this.state.layoutComponents[section.i][0])}</span>
                                        {this.isComponentEditable(this.state.layoutComponents[section.i][0].name) &&
                                        <Button className="page-grid-editor__grid-operation" type="text" icon="edit"
                                            onClick={() => {
                                                this.setState({
                                                    editingComponentId: this.state.layoutComponents[section.i][0].id,
                                                    editingSectionId: section.i
                                                });
                                            }}></Button>
                                        }
                                        <Button className="page-grid-editor__grid-operation" type="text"
                                            onClick={() => this.setState({updatingSectionId: section.i})}><i className="fa fa-gear"/></Button>
                                        <Button className="page-grid-editor__grid-operation" type="text" icon="close"
                                            onClick={() => this.removeSection(section.i)}></Button>
                                    </div>
                                    {this.state.layoutComponents[section.i] &&
                                    this.state.layoutComponents[section.i][0] &&
                                    this.renderComponent(this.state.layoutComponents[section.i][0], section)}
                                </div>
                            </div>
                        )}
                    </ReactGridLayout>
                }
                {this.state.updatingSectionId &&
                <TemplateGridEditor section={this.getSection(this.state.updatingSectionId)}
                    onChange={section => this.updateSection(section)}
                    onCancel={() => this.cancelCreate()}
                    template={this.state.template}/>
                }
            </div>
        );
    }
}

LayoutGridEditor.propTypes = {
    sections: PropTypes.array,
    onChange: PropTypes.func
};