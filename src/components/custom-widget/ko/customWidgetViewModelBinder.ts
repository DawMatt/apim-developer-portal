import { Bag } from "@paperbits/common";
import { EventManager, Events } from "@paperbits/common/events";
import { ComponentFlow, IWidgetBinding } from "@paperbits/common/editing";
import { ViewModelBinder } from "@paperbits/common/widgets";
import { StyleCompiler } from "@paperbits/common/styles";
import { ISettingsProvider } from "@paperbits/common/configuration";
import { MapiBlobStorage } from "../../../persistence";
import { widgetName, widgetDisplayName, widgetEditorSelector } from "../constants";
import { CustomWidgetModel } from "../customWidgetModel";
import { CustomWidgetViewModel } from "./customWidgetViewModel";
import { buildWidgetSource } from "./utils";

export class CustomWidgetViewModelBinder implements ViewModelBinder<CustomWidgetModel, CustomWidgetViewModel>  {
    public readonly instanceId: number;

    constructor(
        private readonly eventManager: EventManager,
        private readonly styleCompiler: StyleCompiler,
        private readonly settingsProvider: ISettingsProvider,
        private readonly blobStorage: MapiBlobStorage,
    ) {
        this.instanceId = Math.random();
    }

    public async updateViewModel(model: CustomWidgetModel, viewModel: CustomWidgetViewModel, bindingContext: Bag<any>): Promise<void> {
        if (model.styles) {
            viewModel.styles(await this.styleCompiler.getStyleModelAsync(model.styles, bindingContext?.styleManager));
        }

        const environment = await this.settingsProvider.getSetting<string>("environment");
        viewModel.name(model.name);
        const widgetSource = await buildWidgetSource(this.blobStorage, model, environment, this.instanceId, "index.html");
        viewModel.src(widgetSource.src);
        viewModel.override(widgetSource.override);
    }

    public async modelToViewModel(model: CustomWidgetModel, viewModel?: CustomWidgetViewModel, bindingContext?: Bag<any>): Promise<CustomWidgetViewModel> {
        if (!viewModel) {
            viewModel = new CustomWidgetViewModel();

            viewModel["widgetBinding"] = {
                name: widgetName,
                displayName: widgetDisplayName,
                readonly: bindingContext ? bindingContext.readonly : false,
                model: model,
                flow: ComponentFlow.Block,
                editor: widgetEditorSelector,
                draggable: true,
                layer: bindingContext?.layer, // TODO remove once optional
                applyChanges: async () => {
                    await this.updateViewModel(model, viewModel, bindingContext);
                    this.eventManager.dispatchEvent(Events.ContentUpdate);
                }
            } as IWidgetBinding<CustomWidgetModel, CustomWidgetViewModel>;
        }

        this.updateViewModel(model, viewModel, bindingContext);

        return viewModel;
    }

    public canHandleModel(model: CustomWidgetModel): boolean {
        return model instanceof CustomWidgetModel;
    }
}