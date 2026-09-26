import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, ScrollViewer, Control } from '@babylonjs/gui';

export class EmergencyHUD {
  constructor(scene) {
    this.scene = scene;
    this.calls = [];
    this.visible = false;
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI('emergencyHUD', true, scene);

    this.panel = new Rectangle('emPanel');
    this.panel.width = '520px';
    this.panel.height = '80%';
    this.panel.thickness = 2;
    this.panel.color = '#ff3333';
    this.panel.background = 'rgba(15,15,20,0.92)';
    this.panel.cornerRadius = 10;
    this.panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.panel.left = '20px';
    this.panel.isVisible = false;
    this.ui.addControl(this.panel);

    const title = new TextBlock('emTitle', '🚨 CENTRAL 911 — TABLEAU');
    title.color = '#ff4444'; title.fontSize = 20; title.height = '40px';
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.panel.addControl(title);

    this.scroll = new ScrollViewer('emScroll');
    this.scroll.width = '100%';
    this.scroll.height = 'calc(100% - 90px)';
    this.scroll.top = '45px';
    this.scroll.barColor = '#ff4444';
    this.panel.addControl(this.scroll);

    this.stack = new StackPanel('emStack');
    this.stack.width = '100%';
    this.stack.isVertical = true;
    this.scroll.addControl(this.stack);

    const hint = new TextBlock('emHint', '[F9] Fermer');
    hint.color = '#888'; hint.fontSize = 14; hint.height = '30px';
    hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.panel.addControl(hint);
  }
  toggle() { this.visible = !this.visible; this.panel.isVisible = this.visible; if (this.visible) this._render(); }
  setCalls(calls) { this.calls = calls; if (this.visible) this._render(); }
  _render() {
    this.stack.clearControls();
    if (!this.calls.length) {
      const e = new TextBlock('empty', 'Aucun appel actif.');
      e.color = '#888'; e.height = '40px'; this.stack.addControl(e); return;
    }
    const colors = { code_1_normal: '#4caf50', code_2_urgent: '#ff9800', code_3_critique: '#f44336' };
    for (const c of this.calls) {
      const card = new Rectangle('c_' + c.id);
      card.height = '100px'; card.thickness = 1;
      card.color = colors[c.priority] || '#666';
      card.background = 'rgba(30,30,40,0.85)';
      card.cornerRadius = 6;
      const t = new TextBlock('t', c.callNumber + '  •  ' + c.type + '\n' +
        c.locationDescription + '\nStatut: ' + c.status + '  |  Unités: ' + c.assignedUnits.length);
      t.color = '#eee'; t.fontSize = 13;
      t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      t.paddingLeft = '10px';
      card.addControl(t);
      this.stack.addControl(card);
    }
  }
}
