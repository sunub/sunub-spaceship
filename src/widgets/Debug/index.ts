import { Pane } from "tweakpane"

import type { PaneConfig } from "tweakpane/dist/types/pane/pane-config"

export class Debug extends Pane
{
	public options: PaneConfig
	constructor(options: PaneConfig)
	{
		super(options)
		this.options = options
	}
}
